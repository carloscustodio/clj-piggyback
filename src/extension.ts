import * as vscode from 'vscode';
import * as net from 'net';

export function activate(context: vscode.ExtensionContext) {
  console.log('Piggyback extension is now active!');

  // Register the command that opens the REPL Webview
  let disposable = vscode.commands.registerCommand('piggyback.startREPL', () => {
    // Create and show a new webview panel
    const panel = vscode.window.createWebviewPanel(
      'piggybackREPL', // Identifies the type of the webview. Used internally
      'Piggyback REPL', // Title of the panel displayed to the user
      vscode.ViewColumn.One, // Editor column to show the new webview panel in.
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    // Set the webview's content with theme-aware styling
    panel.webview.html = getWebviewContent();

    // Listen for messages from the webview
    panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'sendInput':
            vscode.window.showInformationMessage(`Received input: ${message.text}`);
            return;
        }
      },
      undefined,
      context.subscriptions
    );

    // Listen for messages to send input to nREPL
    panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'sendInput':
            try {
              if (!nreplConnection) {
                const port = 7888; // Default nREPL port
                nreplConnection = await connectToNRepl(port);
              }
              // Write the command to nREPL (simplified)
              nreplConnection.write(message.text + '\n');
            } catch (err) {
              console.error('Failed to evaluate expression:', err);
              vscode.window.showErrorMessage('Failed to connect to nREPL server');
            }
            return;
        }
      },
      undefined,
      context.subscriptions
    );
  });

  context.subscriptions.push(disposable);
}

let nreplConnection: net.Socket | null = null;

function connectToNRepl(port: number, host: string = 'localhost'): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ port, host }, () => {
      console.log('Connected to nREPL server');
      resolve(client);
    });

    client.on('error', (err) => {
      console.error('nREPL connection error:', err);
      reject(err);
    });

    client.on('close', () => {
      console.log('nREPL connection closed');
      nreplConnection = null;
    });
  });
}

export function deactivate() {}

function getWebviewContent(): string {
  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' vscode-resource:; script-src 'unsafe-inline' vscode-resource:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Piggyback REPL</title>
  <style>
    /* Use VS Code theme variables for styling */
    body {
      margin: 0;
      padding: 0;
      font-family: var(--vscode-font-family, sans-serif);
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
    }
    #output {
      height: calc(100vh - 50px);
      overflow-y: auto;
      border-bottom: 1px solid var(--vscode-editorWidget-border, #ccc);
      padding: 10px;
      background-color: var(--vscode-editor-background);
    }
    #input {
      width: 100%;
      box-sizing: border-box;
      padding: 10px;
      border: none;
      border-top: 1px solid var(--vscode-editorWidget-border, #ccc);
      font-size: 1em;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
    }
  </style>
</head>
<body>
  <div id="output">REPL Output will appear here...</div>
  <input id="input" type="text" placeholder="Enter a Clojure expression and press Enter" />
  <script>
    (function() {
      const vscode = acquireVsCodeApi();
      const inputField = document.getElementById('input');
      const outputArea = document.getElementById('output');

      inputField.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          const text = inputField.value;
          vscode.postMessage({ command: 'sendInput', text: text });
          const newLine = document.createElement('div');
          newLine.textContent = '> ' + text;
          outputArea.appendChild(newLine);
          inputField.value = '';
        }
      });
    }());
  </script>
</body>
</html>
`;
}