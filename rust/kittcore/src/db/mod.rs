//! SQLite WASM Database Module (Experimental)
//! 
//! Provides Rust-side SQLite access for WASM using sqlite-wasm-rs.
//! Supports OPFS persistence via the sahpool VFS.
//! 
//! **WARNING**: Not thread-safe (SQLITE_THREADSAFE=0)

use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use sqlite_wasm_rs as ffi;
use sqlite_wasm_vfs::sahpool::{self, OpfsSAHPoolCfgBuilder, OpfsSAHPoolUtil};
use std::cell::RefCell;

/// Global VFS utility handle (stored after installation)
thread_local! {
    static VFS_UTIL: RefCell<Option<OpfsSAHPoolUtil>> = const { RefCell::new(None) };
}

/// Database connection wrapper
pub struct Database {
    db: *mut ffi::sqlite3,
}

impl Database {
    /// Open an in-memory database (for testing)
    pub fn open_memory() -> Result<Self, String> {
        let mut db: *mut ffi::sqlite3 = std::ptr::null_mut();
        
        let ret = unsafe {
            ffi::sqlite3_open_v2(
                c"mem.db".as_ptr().cast(),
                &mut db as *mut _,
                ffi::SQLITE_OPEN_READWRITE | ffi::SQLITE_OPEN_CREATE,
                std::ptr::null(),
            )
        };
        
        if ret != ffi::SQLITE_OK {
            return Err(format!("Failed to open database: error code {}", ret));
        }
        
        Ok(Self { db })
    }
    
    /// Open a database with OPFS persistence (requires VFS to be installed first)
    pub fn open_opfs(db_name: &str) -> Result<Self, String> {
        let mut db: *mut ffi::sqlite3 = std::ptr::null_mut();
        
        // Construct the VFS path - sahpool VFS prepends its directory
        let db_path = std::ffi::CString::new(db_name)
            .map_err(|e| format!("Invalid database name: {}", e))?;
        
        // Use the opfs-sahpool VFS explicitly
        let vfs_name = c"opfs-sahpool";
        
        let ret = unsafe {
            ffi::sqlite3_open_v2(
                db_path.as_ptr(),
                &mut db as *mut _,
                ffi::SQLITE_OPEN_READWRITE | ffi::SQLITE_OPEN_CREATE,
                vfs_name.as_ptr(),
            )
        };
        
        if ret != ffi::SQLITE_OK {
            return Err(format!("Failed to open OPFS database: error code {}", ret));
        }
        
        Ok(Self { db })
    }
    
    /// Execute a simple SQL statement (no results)
    pub fn execute(&self, sql: &str) -> Result<(), String> {
        let c_sql = std::ffi::CString::new(sql)
            .map_err(|e| format!("Invalid SQL string: {}", e))?;
        
        let mut err_msg: *mut i8 = std::ptr::null_mut();
        
        let ret = unsafe {
            ffi::sqlite3_exec(
                self.db,
                c_sql.as_ptr(),
                None,
                std::ptr::null_mut(),
                &mut err_msg,
            )
        };
        
        if ret != ffi::SQLITE_OK {
            let error = if !err_msg.is_null() {
                let msg = unsafe { std::ffi::CStr::from_ptr(err_msg) };
                let s = msg.to_string_lossy().to_string();
                unsafe { ffi::sqlite3_free(err_msg.cast()) };
                s
            } else {
                format!("Error code: {}", ret)
            };
            return Err(error);
        }
        
        Ok(())
    }
    
    /// Get SQLite version string
    pub fn version() -> String {
        let version = unsafe { ffi::sqlite3_libversion() };
        if version.is_null() {
            return "unknown".to_string();
        }
        unsafe { std::ffi::CStr::from_ptr(version) }
            .to_string_lossy()
            .to_string()
    }
}

impl Drop for Database {
    fn drop(&mut self) {
        if !self.db.is_null() {
            unsafe { ffi::sqlite3_close(self.db) };
        }
    }
}

// ============================================================================
// WASM Bindings (for testing from TypeScript)
// ============================================================================

#[wasm_bindgen]
pub struct WasmDatabase {
    inner: Database,
}

#[wasm_bindgen]
impl WasmDatabase {
    /// Create a new in-memory database
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<WasmDatabase, JsValue> {
        Database::open_memory()
            .map(|db| WasmDatabase { inner: db })
            .map_err(|e| JsValue::from_str(&e))
    }
    
    /// Open a persistent OPFS database
    /// Note: Must call WasmDatabase.installOpfsVfs() first!
    #[wasm_bindgen(js_name = openOpfs)]
    pub fn open_opfs(db_name: &str) -> Result<WasmDatabase, JsValue> {
        Database::open_opfs(db_name)
            .map(|db| WasmDatabase { inner: db })
            .map_err(|e| JsValue::from_str(&e))
    }
    
    /// Execute SQL statement
    #[wasm_bindgen]
    pub fn execute(&self, sql: &str) -> Result<(), JsValue> {
        self.inner.execute(sql).map_err(|e| JsValue::from_str(&e))
    }
    
    /// Get SQLite version
    #[wasm_bindgen(js_name = getVersion)]
    pub fn get_version() -> String {
        Database::version()
    }
    
    /// Install the OPFS SAHPool VFS (must be called once before using OPFS)
    /// Returns a Promise that resolves when VFS is ready
    #[wasm_bindgen(js_name = installOpfsVfs)]
    pub fn install_opfs_vfs(directory: &str) -> js_sys::Promise {
        let dir = directory.to_string();
        
        future_to_promise(async move {
            let config = OpfsSAHPoolCfgBuilder::new()
                .directory(&dir)
                .build();
            
            // Call install without generic parameter - it uses the default callback
            let util = sahpool::install(&config, false)
                .await
                .map_err(|e| JsValue::from_str(&format!("Failed to install OPFS VFS: {:?}", e)))?;
            
            // Store the utility handle globally
            VFS_UTIL.with(|cell| {
                *cell.borrow_mut() = Some(util);
            });
            
            Ok(JsValue::from_str("OPFS VFS installed successfully"))
        })
    }
    
    /// Check if OPFS VFS is installed
    #[wasm_bindgen(js_name = isOpfsReady)]
    pub fn is_opfs_ready() -> bool {
        VFS_UTIL.with(|cell| cell.borrow().is_some())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_version() {
        let version = Database::version();
        assert!(!version.is_empty());
        println!("SQLite version: {}", version);
    }
}
