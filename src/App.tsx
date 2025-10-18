import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import Chat from "./components/Chat";
import { usePlateEditor } from "platejs/react";
import { Editor, EditorContainer } from "./components/ui/editor";
import { BasicNodesKit } from "./components/basic-nodes-kit";
import { Plate } from "platejs/react";
import { PlateEditor } from "./components/plate-editor";

function App() {

  return (
    <div className="h-screen w-screen bg-background text-foreground">
      <PlateEditor />
    </div>
  );
}

export default App;
