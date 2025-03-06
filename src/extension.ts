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
        enableScripts: true, // Allow scripts in the webview
        retainContextWhenHidden: true
      }
    );

    // Set the webview's content
    panel.webview.html = getWebviewContent();

    // Listen for messages from the webview
    panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'sendInput':
            // In a complete implementation, the input text would be sent to the Clojure process.
            // Here, we simply log it and echo a confirmation via an info message.
            vscode.window.showInformationMessage(`Received input: ${message.text}`);
            return;
        }
      },
      undefined,
      context.subscriptions
    );
    // Listen for messages from the webview
    panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'sendInput':
            try {
              // Try to connect if not already connected
              if (!nreplConnection) {
                // This could come from configuration or port file
                const port = 7888; // Default nREPL port
                nreplConnection = await connectToNRepl(port);
              }
              
              // Send the command to nREPL
              // Note: This is simplified - nREPL uses a specific bencode protocol
              nreplConnection.write(message.text + '\n');
              
              // In a real implementation, you would parse the response
              // and send it back to the webview
              
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

// Add this to the activate function
let nreplConnection: net.Socket | null = null;

// Add a function to connect to nREPL
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
  // HTML for a basic REPL user interface.
  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' vscode-resource:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Piggyback REPL</title>
  <style>
    body {
      font-family: sans-serif;
      margin: 0;
      padding: 0;
    }
    #output {
      height: calc(100vh - 50px);
      overflow-y: auto;
      border-bottom: 1px solid #ccc;
      padding: 10px;
      background-color: #f9f9f9;
    }
    #input {
      width: 100%;
      box-sizing: border-box;
      padding: 10px;
      border: none;
      border-top: 1px solid #ccc;
      font-size: 1em;
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
          // Send the user input to the extension code
          vscode.postMessage({ command: 'sendInput', text: text });

          // For demonstration purposes, echo the entered command to the output area.
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
