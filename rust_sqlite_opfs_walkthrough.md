# Rust WASM SQLite + OPFS Setup Walkthrough

This guide documents the steps taken to successfully integrate a full Rust-side SQLite database (with `sqlite-wasm-rs`) into the `kittcore` WASM module, complete with Origin Private File System (OPFS) support using `sahpool`.

## 1. Prerequisites (Windows)

The critical dependency for compiling SQLite C code to WASM is **LLVM/Clang**. The default MSVC compiler cannot do this cross-compilation.

### Installing LLVM
We used `winget` for a minimal-hassle installation:

```powershell
winget install LLVM.LLVM --accept-package-agreements --accept-source-agreements
```

This installs `clang` and `llvm-ar` into `C:\Program Files\LLVM\bin`.

### Environment Setup
You must ensure `clang` is in your PATH and set the `CC` environment variable before building.

```powershell
$env:Path = "C:\Program Files\LLVM\bin;" + $env:Path
$env:CC = "clang"
```

## 2. Rust Dependencies

We added the following to `rust/kittcore/Cargo.toml`:

```toml
# SQLite WASM (Standard - Rust-side DB access with OPFS)
# Requires LLVM/Clang installed for C->WASM compilation
sqlite-wasm-rs = "0.5"
sqlite-wasm-vfs = "0.1"
```

*   `sqlite-wasm-rs v0.5`: The core bindings to SQLite3.
*   `sqlite-wasm-vfs v0.1`: Provides the Virtual File System (VFS) implementations, specifically `sahpool` for OPFS.

**Why v0.5?**
Version 0.4 had a "precompiled" feature that avoided Clang, but it didn't support the `opfs-sahpool` VFS needed for persistence. We upgraded to v0.5 (which requires Clang) to get full persistence support.

## 3. Rust Implementation (`db/mod.rs`)

We created a new module `src/db/mod.rs` to handle the database logic. The key parts are:

### Async VFS Installation
The `sahpool` VFS must be "installed" (initialized) asynchronously before any DB can be opened.

```rust
use sqlite_wasm_vfs::sahpool::{self, OpfsSAHPoolCfgBuilder};

// ... inside a future_to_promise ...
let config = OpfsSAHPoolCfgBuilder::new()
    .directory(&dir)
    .build();

// Install the VFS
sahpool::install::<ffi::WasmOsCallback>(&config, false).await?;
```

### Opening the Database
We use `sqlite3_open_v2` with the specific VFS name `"opfs-sahpool"`.

```rust
let vfs_name = c"opfs-sahpool";
ffi::sqlite3_open_v2(
    path.as_ptr(),
    &mut db,
    ffi::SQLITE_OPEN_READWRITE | ffi::SQLITE_OPEN_CREATE,
    vfs_name.as_ptr(), // <--- Critical: specifies using OPFS
)
```

### WASM Bindings
We exposed a TypeScript-friendly API via `#[wasm_bindgen]`:

```rust
#[wasm_bindgen]
impl WasmDatabase {
    // 1. One-time setup (must await this Promise)
    #[wasm_bindgen(js_name = installOpfsVfs)]
    pub fn install_opfs_vfs(directory: &str) -> js_sys::Promise { ... }

    // 2. Open persistent DB
    #[wasm_bindgen(js_name = openOpfs)]
    pub fn open_opfs(db_name: &str) -> Result<WasmDatabase, JsValue> { ... }
    
    // 3. Execute SQL
    pub fn execute(&self, sql: &str) -> Result<(), JsValue> { ... }
}
```

## 4. Building

The build command must include the environment setup:

```powershell
$env:Path = "C:\Program Files\LLVM\bin;" + $env:Path; $env:CC = "clang"; wasm-pack build --target web --out-dir ../../src/lib/wasm/kittcore
```

This produced a ~17MB WASM binary (Release build), containing the full SQLite engine + VFS layer.

## 5. Usage in TypeScript

Because OPFS SyncAccessHandles are synchronous, this **MUST be run in a Web Worker**. It will block the main thread otherwise.

```typescript
import { WasmDatabase } from '@/lib/wasm/kittcore/kittcore';

// Inside a Worker:

async function initDB() {
  // 1. Initialize VFS (creates 'kittcloud-db' folder in OPFS root)
  await WasmDatabase.installOpfsVfs('kittcloud-db');
  
  // 2. Open persistent database file
  const db = WasmDatabase.openOpfs('notes.sqlite');
  
  // 3. Run queries
  db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY, 
      content TEXT
    )
  `);
  
  console.log("DB Ready via Rust + OPFS!");
}
```

## 6. Troubleshooting Notes

*   **`ToolNotFound: failed to find tool "clang"`**: The `sqlite-wasm-rs` build script couldn't find `clang`. Ensure it's installed and in `%PATH%`.
*   **Version Mismatch**: `sqlite-wasm-vfs` pulls in `sqlite-wasm-rs v0.5`, so you cannot force v0.4 in your main Cargo.toml if you want VFS support.
*   **Generic Parameters**: The `sahpool::install` function signature changed between versions. The correct usage for v0.1.0/v0.5 is `sahpool::install(&config, false)`.
