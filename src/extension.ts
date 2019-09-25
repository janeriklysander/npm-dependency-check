import * as cp from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

let packageWatcher: vscode.FileSystemWatcher;

export async function activate(context: vscode.ExtensionContext) {
  if (!vscode.workspace.workspaceFolders) {
    return;
  }

  for (let workspaceFolder of vscode.workspace.workspaceFolders) {
    const workspacePath = workspaceFolder.uri.fsPath;

    const packagePattern = path.join(workspacePath, "package.json");

    if (!(await exists(packagePattern))) {
      return;
    }

    packageWatcher = vscode.workspace.createFileSystemWatcher(packagePattern);

    packageWatcher.onDidChange(
      async () => checkInstalledModules(workspacePath),
      [],
      context.subscriptions
		);
		
		checkInstalledModules(workspacePath);
  }
}

function checkInstalledModules(workspacePath: string) {
  const command = "installed-check --version-check";
  // const result = await exec(command, {});
  exec(command, { cwd: workspacePath }).catch(() => {
		const npmInstall = 'Fix this for me';
    vscode.window.showWarningMessage(
			"Your installed NPM packages are out of date.",
			...[npmInstall]
    ).then(async (value) => {
			if (value === npmInstall) {
				await exec('npm install', {cwd: workspacePath}).then(() => {
					vscode.window.showInformationMessage('Your NPM packages are now up to date, happy coding!');
				}).catch(() => {
					vscode.window.showErrorMessage('Oh this is awkward, the "npm install" failed. Please try manually, sorry!');
				});
			}
		});  
  });
}

function exists(file: string): Promise<boolean> {
  return new Promise<boolean>((resolve, _reject) => {
    fs.exists(file, value => {
      resolve(value);
    });
  });
}

function exec(
  command: string,
  options: cp.ExecOptions
): Promise<{ stdout: string; stderr: string }> {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    cp.exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
      }
      resolve({ stdout, stderr });
    });
  });
}

// this method is called when your extension is deactivated
export function deactivate() {
	console.log('deactivate');
  packageWatcher.dispose();
}
