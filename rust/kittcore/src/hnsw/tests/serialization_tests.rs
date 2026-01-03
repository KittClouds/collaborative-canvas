use crate::hnsw::index::{Hnsw, Metric};
use crate::hnsw::node::HnswNode;
use std::collections::{HashMap, HashSet};

// Use a deterministic seed for tests
fn create_test_hnsw(n: usize) -> Hnsw {
    let mut hnsw = Hnsw::new(16, 100, Metric::Cosine);
    // Add points
    for i in 0..n {
        let v = vec![0.1 * i as f32, 0.1 * (i + 1) as f32, 0.1 * (i + 2) as f32];
        hnsw.add_point(i as u32, v).unwrap();
    }
    hnsw
}

#[test]
fn test_roundtrip_small_graph() {
    let hnsw = create_test_hnsw(10);
    let bytes = hnsw.serialize();
    
    let restored = Hnsw::deserialize(&bytes).unwrap_or_else(|e| {
        panic!("Deserialization failed: {}", e);
    });
    
    assert_eq!(hnsw.len(), restored.len());
    // ...
}

#[test]
fn test_roundtrip_search_consistency() {
    let mut hnsw = Hnsw::new(16, 100, Metric::Cosine);
    // ...
    hnsw.add_point(1, vec![1.0, 0.0, 0.0]).unwrap();
    hnsw.add_point(2, vec![0.0, 1.0, 0.0]).unwrap();
    hnsw.add_point(3, vec![0.0, 0.0, 1.0]).unwrap();
    hnsw.add_point(4, vec![0.5, 0.5, 0.0]).unwrap();
    
    let bytes = hnsw.serialize();
    let restored = Hnsw::deserialize(&bytes).unwrap_or_else(|e| {
         panic!("Deserialization failed in consistency test: {}", e);
    });
    
    let query = vec![0.6, 0.4, 0.0];
    let res1 = hnsw.search_knn(&query, 2);
    let res2 = restored.search_knn(&query, 2);
    
    assert_eq!(res1, res2, "Search results mismatch: {:?} vs {:?}", res1, res2);
}

#[test]
fn test_invalid_magic_fails() {
    let mut hnsw = create_test_hnsw(5);
    let mut bytes = hnsw.serialize();
    // Corrupt magic
    bytes[0] = 0x00; 
    
    let res = Hnsw::deserialize(&bytes);
    assert!(res.is_err());
}

#[test]
fn test_corrupted_dimension_fails() {
    let mut hnsw = create_test_hnsw(5);
    let mut bytes = hnsw.serialize();
    
    // Original dim is 3.
    // Length check:
    // Header (14) + 5 nodes * (...)
    // Each node: u32(4) + u8(1) + vec(3*4=12) + levels...
    
    // If we claim dimension is 100, vector reading should fail or EOF
    // Bytes 4-5 are dimension (u16). 3 -> 0x0003
    // Set to 0xFFFF
    bytes[4] = 0xFF;
    bytes[5] = 0xFF;
    
    let res = Hnsw::deserialize(&bytes);
    assert!(res.is_err());
}

#[test]
fn test_deleted_status_persisted() {
    let mut hnsw = create_test_hnsw(10);
    hnsw.delete_point(5);
    
    let bytes = hnsw.serialize();
    let restored = Hnsw::deserialize(&bytes).unwrap();
    
    let res = restored.search_knn(&[0.5, 0.6, 0.7], 10);
    assert!(!res.iter().any(|(id, _)| *id == 5));
}
