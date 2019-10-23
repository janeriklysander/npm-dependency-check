import * as cp from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

const EXTENSION_NAME = "npm-dependency-check";

let packageWatchers: vscode.FileSystemWatcher[] = [];
let checkPackagesCommand: vscode.Disposable;

export async function activate(context: vscode.ExtensionContext) {
  log("activate");
  const config = vscode.workspace.getConfiguration(EXTENSION_NAME);

  if (packageWatchers.length > 0) {
    deactivate();
  }

  if (!vscode.workspace.workspaceFolders) {
    return;
  }

  for (let workspaceFolder of vscode.workspace.workspaceFolders) {
    const workspacePath = workspaceFolder.uri.fsPath;

    checkInstalledModules(workspacePath);

    const packagePattern = path.join(workspacePath, "package.json");

    if (
      !config.get<boolean>("packageFileWatcher") ||
      (await exists(packagePattern))
    ) {
      return;
    }

    const index =
      packageWatchers.push(
        vscode.workspace.createFileSystemWatcher(packagePattern)
      ) - 1;

    packageWatchers[index].onDidChange(
      async () => await checkInstalledModules(workspacePath),
      [],
      context.subscriptions
    );
  }

  checkPackagesCommand = vscode.commands.registerCommand(
    `${EXTENSION_NAME}.checkPackages`,
    async () => {
      const workspaceFolder = await vscode.window.showWorkspaceFolderPick();

      if (!workspaceFolder) {
        vscode.window.showWarningMessage(`You didn't select a workspace`);
        return;
      }

      checkInstalledModules(workspaceFolder.uri.path);

    }
  );
}

async function checkInstalledModules(workspacePath: string) {
  const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
  const installedCheckCommand = "installed-check --version-check";

  return await exec(installedCheckCommand, { cwd: workspacePath }).catch(() => {
    const fixIt = "Fix this for me";
    const modal = config.get<boolean>("openWarningInModal");

    vscode.window
      .showWarningMessage(
        `Your installed packages are out of date.`,
        { modal },
        ...[fixIt]
      )
      .then(async value => {
        if (value === fixIt) {
          const packageManager = config.get<string>("packageManager");
          await exec(`${packageManager} install`, { cwd: workspacePath })
            .then(() => {
              vscode.window.showInformationMessage(
                `Your packages are now up to date, happy coding!`
              );
            })
            .catch(() => {
              vscode.window.showErrorMessage(
                `Oh this is awkward, the "${packageManager} install" failed. Please try manually, sorry!`,
                { modal }
              );
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

function log(...args: unknown[]) {
  console.log(`${EXTENSION_NAME}:`, ...args);
}

export function deactivate() {
  log("deactivate");
  packageWatchers.map(pW => pW.dispose());
  packageWatchers = [];
  checkPackagesCommand.dispose();
}
