// Bagimsiz, dis kabuk (crate) gerektirmeyen HTTP dosya sunucusu.
//
// Amac: web tarayicisindan (Tauri'ye bagli olmayan bir istemci) sabit bir
// sunucu uzerindeki bir klasore tam dosya erisimi saglamak. Ayni islem
// icinde Tauri ile birlikte calisir; boylece ek servis gerekmez.
//
// Guvenlik: sunucu yalnizca JSONEDITOR_FS_ROOT altinda kalan yollara izin
// verir (canonicalize + prefix kontrolu). Kimlik dogrulama yoktur; bu
// nedenle yalnizca guvenilir/ic aglarda kullanilmalidir.
//
// Uclar:
//   GET  /fs/list?path=<goreli>   -> { entries: [{name, path, isDir}] }
//   GET  /fs/read?path=<goreli>   -> dosya icerigi (text/plain; UTF-8)
//   POST /fs/write?path=<goreli>  -> govde: icerik; bos govde ile dosya olusturur
//   GET  /fs/exists?path=<goreli> -> {"exists": true|false}

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};

pub fn serve(root: PathBuf, port: u16) {
  let root = match std::fs::canonicalize(&root) {
    Ok(r) => r,
    Err(e) => {
      log::error!("fs sunucusu: kok dizin acilamadi ({root:?}): {e}");
      return;
    }
  };
  let addr = format!("0.0.0.0:{port}");
  let listener = match TcpListener::bind(&addr) {
    Ok(l) => l,
    Err(e) => {
      log::error!("fs sunucusu: {addr} dinlenemedi: {e}");
      return;
    }
  };
  log::info!("fs sunucusu dinliyor: http://{addr} (kok: {root:?})");

  for stream in listener.incoming() {
    match stream {
      Ok(s) => {
        let root = root.clone();
        std::thread::spawn(move || {
          let _ = handle(s, &root);
        });
      }
      Err(e) => log::warn!("fs sunucusu: baglanti hatasi: {e}"),
    }
  }
}

/// Kullanici yolunu kok altinda mutlak bir yola cevirir.
/// `..` ve sembolik baglantilarla kacisi canonicalize ile engeller.
fn resolve(root: &Path, rel: &str) -> Result<PathBuf, String> {
  // Istemci yollari "/" ile kok-goreli gelir; join mutlak yolu ezip
  // koku atlamasin diye basi kirpilir.
  let rel = rel.trim_start_matches('/');
  let joined = root.join(rel);
  // Yazim icin dosya henuz var olmayabilir; once en yakin var olan
  // ata canonicalize edilip son bilesen eklenir.
  let target = match std::fs::canonicalize(&joined) {
    Ok(p) => p,
    Err(_) => {
      let parent = joined.parent().ok_or("gecersiz yol")?;
      let name = joined.file_name().ok_or("gecersiz dosya adi")?;
      let cparent = std::fs::canonicalize(parent).map_err(|_| "ust dizin yok")?;
      cparent.join(name)
    }
  };
  if target == *root || target.starts_with(root) {
    Ok(target)
  } else {
    Err("yol kok dizin disinda".into())
  }
}

fn handle(mut stream: TcpStream, root: &Path) -> std::io::Result<()> {
  let mut buf: Vec<u8> = Vec::new();
  let mut tmp = [0u8; 8192];
  // Basligi bulana kadar oku (cift CRLF).
  let header_end;
  loop {
    let n = stream.read(&mut tmp)?;
    if n == 0 {
      return Ok(());
    }
    buf.extend_from_slice(&tmp[..n]);
    if let Some(pos) = find_subslice(&buf, b"\r\n\r\n") {
      header_end = pos + 4;
      break;
    }
    if buf.len() > 64 * 1024 {
      return respond(&mut stream, 431, "text/plain", b"header too large");
    }
  }

  let head = String::from_utf8_lossy(&buf[..header_end]).to_string();
  let mut lines = head.split("\r\n");
  let request_line = lines.next().unwrap_or("");
  let mut parts = request_line.split_whitespace();
  let method = parts.next().unwrap_or("").to_string();
  let target = parts.next().unwrap_or("/").to_string();

  let content_length = lines
    .filter_map(|l| {
      let (k, v) = l.split_once(':')?;
      if k.eq_ignore_ascii_case("content-length") {
        v.trim().parse::<usize>().ok()
      } else {
        None
      }
    })
    .next()
    .unwrap_or(0);

  // Yoldan query ve path parametresini cikar.
  let (route, query) = match target.split_once('?') {
    Some((r, q)) => (r, q),
    None => (target.as_str(), ""),
  };
  let rel = query_param(query, "path").unwrap_or_else(|| "/".to_string());

  if method == "GET" && route == "/fs/health" {
    return respond(&mut stream, 200, "text/plain", b"ok");
  }

  let resolved = match resolve(root, &rel) {
    Ok(p) => p,
    Err(e) => return respond(&mut stream, 403, "text/plain", e.as_bytes()),
  };

  match (method.as_str(), route) {
    ("GET", "/fs/list") => list(&mut stream, root, &resolved),
    ("GET", "/fs/read") => read(&mut stream, &resolved),
    ("GET", "/fs/exists") => exists(&mut stream, &resolved),
    ("POST", "/fs/write") => {
      // Govdeyi oku (basligi asan kisim + eksik kalan).
      let mut body = buf[header_end..].to_vec();
      while body.len() < content_length {
        let n = stream.read(&mut tmp)?;
        if n == 0 {
          break;
        }
        body.extend_from_slice(&tmp[..n]);
      }
      write(&mut stream, &resolved, &body)
    }
    _ => respond(&mut stream, 404, "text/plain", b"not found"),
  }
}

fn list(stream: &mut TcpStream, root: &Path, dir: &Path) -> std::io::Result<()> {
  // Istemciye kok-goreli yollar dondurulur.
  let entries = match std::fs::read_dir(dir) {
    Ok(e) => e,
    Err(e) => return respond(stream, 400, "text/plain", format!("okunamadi: {e}").as_bytes()),
  };
  let mut out = String::from("{\"entries\":[");
  let mut first = true;
  for entry in entries.flatten() {
    let name = entry.file_name().to_string_lossy().to_string();
    if name.starts_with('.') {
      continue;
    }
    let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
    let path = entry.path();
    let rel = path
      .strip_prefix(root)
      .map(|p| format!("/{}", p.to_string_lossy()))
      .unwrap_or_else(|_| path.to_string_lossy().to_string());
    if !first {
      out.push(',');
    }
    first = false;
    out.push_str(&format!(
      "{{\"name\":{},\"path\":{},\"isDir\":{}}}",
      json_str(&name),
      json_str(&rel),
      is_dir
    ));
  }
  out.push_str("]}");
  respond(stream, 200, "application/json", out.as_bytes())
}

fn read(stream: &mut TcpStream, file: &Path) -> std::io::Result<()> {
  match std::fs::read(file) {
    Ok(bytes) => respond(stream, 200, "text/plain; charset=utf-8", &bytes),
    Err(e) => respond(stream, 404, "text/plain", format!("okunamadi: {e}").as_bytes()),
  }
}

fn exists(stream: &mut TcpStream, path: &Path) -> std::io::Result<()> {
  let body = format!("{{\"exists\":{}}}", path.exists());
  respond(stream, 200, "application/json", body.as_bytes())
}

fn write(stream: &mut TcpStream, file: &Path, body: &[u8]) -> std::io::Result<()> {
  if let Some(parent) = file.parent() {
    let _ = std::fs::create_dir_all(parent);
  }
  match std::fs::write(file, body) {
    Ok(()) => respond(stream, 200, "application/json", b"{\"ok\":true}"),
    Err(e) => respond(stream, 500, "text/plain", format!("yazilamadi: {e}").as_bytes()),
  }
}

fn respond(stream: &mut TcpStream, status: u16, ctype: &str, body: &[u8]) -> std::io::Result<()> {
  let reason = match status {
    200 => "OK",
    400 => "Bad Request",
    403 => "Forbidden",
    404 => "Not Found",
    431 => "Request Header Fields Too Large",
    500 => "Internal Server Error",
    _ => "OK",
  };
  // CORS: web istemcisi farkli origin'den cagirabilsin.
  let header = format!(
    "HTTP/1.1 {status} {reason}\r\nContent-Type: {ctype}\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: *\r\nConnection: close\r\n\r\n",
    body.len()
  );
  stream.write_all(header.as_bytes())?;
  stream.write_all(body)?;
  stream.flush()
}

fn find_subslice(haystack: &[u8], needle: &[u8]) -> Option<usize> {
  haystack
    .windows(needle.len())
    .position(|w| w == needle)
}

fn query_param(query: &str, key: &str) -> Option<String> {
  for pair in query.split('&') {
    let (k, v) = pair.split_once('=')?;
    if k == key {
      return Some(percent_decode(v));
    }
  }
  None
}

fn percent_decode(s: &str) -> String {
  let bytes = s.as_bytes();
  let mut out = Vec::with_capacity(bytes.len());
  let mut i = 0;
  while i < bytes.len() {
    match bytes[i] {
      b'%' if i + 2 < bytes.len() => {
        let h = (bytes[i + 1] as char).to_digit(16);
        let l = (bytes[i + 2] as char).to_digit(16);
        if let (Some(h), Some(l)) = (h, l) {
          out.push((h * 16 + l) as u8);
          i += 3;
          continue;
        }
        out.push(bytes[i]);
        i += 1;
      }
      b'+' => {
        out.push(b' ');
        i += 1;
      }
      b => {
        out.push(b);
        i += 1;
      }
    }
  }
  String::from_utf8_lossy(&out).to_string()
}

fn json_str(s: &str) -> String {
  let mut out = String::with_capacity(s.len() + 2);
  out.push('"');
  for c in s.chars() {
    match c {
      '"' => out.push_str("\\\""),
      '\\' => out.push_str("\\\\"),
      '\n' => out.push_str("\\n"),
      '\r' => out.push_str("\\r"),
      '\t' => out.push_str("\\t"),
      c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
      c => out.push(c),
    }
  }
  out.push('"');
  out
}
