# Electron model contracts

These TypeScript models are owned by the Electron application. Runtime values
crossing renderer, preload, main-process, and utility-process boundaries are
validated by the Zod schemas in the parent `contracts` directory.
