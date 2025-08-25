# Undici File Polyfill Fix

## Issue

When starting the SkillForge API server, the following error occurred:

```
[dotenv@17.2.1] injecting env (0) from .env -- tip: 📡 observe env with Radar: `https://dotenvx.com/radar` 
/Users/kmounika/Desktop/SkillForge/skillforge-api/node_modules/undici/lib/web/webidl/index.js:512 
webidl.is.File = webidl.util.MakeTypeAssertion(File) 
                                              ^ 

ReferenceError: File is not defined 
```

## Cause

The error occurs because the undici library (used by newer versions of Node.js fetch API) expects a global `File` object to be available, but it's not defined in Node.js by default.

## Solution

A simple polyfill was added at the top of the `server.js` file to define a minimal `File` class:

```javascript
// Add global.File polyfill for undici compatibility
global.File = class File {}
```

This allows the undici library to function correctly without errors.

## Node.js Version

This fix was implemented for Node.js v18.20.5.

## Dependencies

Relevant dependencies in package.json:
- express: ^5.1.0
- dotenv: ^17.2.1
- undici: (included as a dependency of Node.js fetch API)