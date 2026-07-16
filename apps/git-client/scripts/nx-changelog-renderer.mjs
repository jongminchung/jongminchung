import changelogRendererModule from "nx/release/changelog-renderer";
import { captureCommand } from "./process.mjs";

const DefaultChangelogRenderer = changelogRendererModule.default;

export function collectTransitiveWorkspaceDependencies(projectGraph, projectName) {
  const included = new Set([projectName]);
  const pending = [projectName];

  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) continue;
    for (const dependency of projectGraph.dependencies[current] ?? []) {
      if (!projectGraph.nodes[dependency.target] || included.has(dependency.target)) continue;
      included.add(dependency.target);
      pending.push(dependency.target);
    }
  }

  return included;
}

export function createDependencyAwareChangelogRenderer({
  includedProjects,
  projectName,
  workspaceRoot,
}) {
  return class DependencyAwareChangelogRenderer extends DefaultChangelogRenderer {
    globalChangesAffectingProject = new Set();

    async render() {
      for (const change of this.changes) {
        if (change.affectedProjects !== "*" || !change.shortHash) continue;
        const output = await captureCommand(
          "pnpm",
          [
            "exec",
            "nx",
            "show",
            "projects",
            "--affected",
            `--base=${change.shortHash}^`,
            `--head=${change.shortHash}`,
          ],
          {
            cwd: workspaceRoot,
            env: { ...process.env, NX_DAEMON: "false" },
          },
        );
        if (output.split("\n").includes(projectName)) {
          this.globalChangesAffectingProject.add(change.shortHash);
        }
      }
      return super.render();
    }

    filterChanges(changes, project) {
      if (project !== projectName) return super.filterChanges(changes, project);
      return changes.filter((change) => {
        if (change.affectedProjects === "*") {
          return (
            change.shortHash !== undefined &&
            this.globalChangesAffectingProject.has(change.shortHash)
          );
        }
        return change.affectedProjects.some((affectedProject) =>
          includedProjects.has(affectedProject),
        );
      });
    }
  };
}
