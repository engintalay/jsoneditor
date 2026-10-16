import EditorPane from './components/EditorPane';
import MenuBar from './components/MenuBar';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import TabBar from './components/TabBar';

export default function App() {
  return (
    <div className="app">
      <MenuBar />
      <div className="main">
        <Sidebar />
        <div className="center">
          <TabBar />
          <EditorPane />
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
