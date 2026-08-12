export function createGitEnvironment(
    inherited: Readonly<NodeJS.ProcessEnv> = process.env,
    owned: Readonly<NodeJS.ProcessEnv> = {},
): NodeJS.ProcessEnv {
    const environment: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(inherited)) {
        if (value !== undefined && !key.toUpperCase().startsWith("GIT_")) {
            environment[key] = value;
        }
    }
    for (const [key, value] of Object.entries(owned)) {
        if (value === undefined) delete environment[key];
        else environment[key] = value;
    }
    return environment;
}
