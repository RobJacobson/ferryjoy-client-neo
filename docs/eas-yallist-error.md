# EAS Build: "yallist_1.Yallist is not a constructor"

## Root cause

1. **Where it happens**  
   During “Compressing project files”, EAS CLI builds a tarball of your project. That code uses the `tar` package, which (directly or via deps) uses `yallist`.

2. **Why it throws**  
   The code that uses `yallist` is written as:
   - `import * as yallist_1 from 'yallist'` then `new yallist_1.Yallist(...)`  
   In CommonJS, `yallist` does `module.exports = Yallist` (a single default export).  
   When Node loads that as an ESM namespace, you get `yallist_1.default = Yallist` and **no** `yallist_1.Yallist`. So `yallist_1.Yallist` is `undefined` → “is not a constructor”.  
   So this is an **ESM/CommonJS interop** issue between the consumer (EAS/tar stack) and the `yallist` package.

3. **Why your project is involved**  
   Node resolves `require('yallist')` (or the equivalent import) by walking up from the **file that requested it**. If the process that runs the archive step is started with the project as the current directory and loads a script from the project (or a path that causes resolution to start in the project), Node can resolve `yallist` from **your** `node_modules` instead of EAS CLI’s.  
   Your app has `yallist` as a transitive dependency (e.g. `lru-cache` → `yallist` via Babel/Metro). So your tree’s `yallist` (v3.x, CommonJS-only) can be the one that gets loaded, and the EAS/tar code that expects a namespace with `.Yallist` then fails.

4. **Why it “worked before”**  
   Something changed so that the archive step now sees your `node_modules` (and thus your `yallist`). Typical causes:
   - EAS CLI version change (different way of running the archive step).
   - Dependency/lockfile changes (e.g. removing local ws-dottie, simplifying Metro, or different Bun hoisting) so `yallist` (or a package that pulls it in) is now in a place that gets used during compression.
   - Different way of invoking EAS (e.g. `bunx` vs `npm exec`), which can change the process/cwd and thus resolution.

So the underlying issue is **EAS CLI’s archive step loading `yallist` from the project’s `node_modules` and then using it with an ESM-style namespace import that doesn’t match CommonJS `yallist`.**

## What would fix it properly

- **On EAS/Expo side:** Run the archive/compression step in a context that does **not** use the project’s `node_modules` for its own dependencies (e.g. run the tarball code from a temp dir or with a `NODE_PATH` that only includes EAS CLI’s dependencies). That way only EAS’s own `tar`/`yallist` are used and the interop issue goes away.
- **On your side:** You can’t change how EAS imports `yallist`; the fix has to be in EAS CLI.

## What you can do

1. **Report it to Expo**  
   Open an issue on [expo/eas-cli](https://github.com/expo/eas-cli) with:
   - Error: `yallist_1.Yallist is not a constructor` during “Compressing project files”.
   - That the archive step appears to resolve `yallist` from the project’s `node_modules`, and that CommonJS `yallist` doesn’t have a `.Yallist` namespace export, causing the failure.
   - Ask that the archive step run in an isolated context so it doesn’t load project dependencies.

2. **Try an older EAS CLI**  
   Sometimes an older version runs the archive step differently and doesn’t hit this:
   ```bash
   npm exec eas-cli@17 -- build --profile development
   ```
