use crate::hnsw::index::{Hnsw, Metric, HnswError};

// ============================================================================
// Construction Tests
// ============================================================================

#[test]
fn test_add_single_point() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    let vector = vec![1.0, 0.0, 0.0];
    
    let result = hnsw.add_point(1, vector.clone());
    assert!(result.is_ok());
    assert_eq!(hnsw.len(), 1);
}

#[test]
fn test_add_duplicate_id_fails() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    let vector = vec![1.0, 0.0, 0.0];
    
    hnsw.add_point(1, vector.clone()).unwrap();
    let result = hnsw.add_point(1, vector);
    
    assert!(matches!(result, Err(HnswError::DuplicateId(1))));
}

#[test]
fn test_dimension_mismatch_fails() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    
    hnsw.add_point(1, vec![1.0, 0.0, 0.0]).unwrap();
    let result = hnsw.add_point(2, vec![1.0, 0.0]); // Wrong dimension
    
    assert!(matches!(result, Err(HnswError::DimensionMismatch { expected: 3, got: 2 })));
}

// ============================================================================
// Search Tests
// ============================================================================

#[test]
fn test_search_empty_index() {
    let hnsw = Hnsw::new(16, 200, Metric::Cosine);
    let query = vec![1.0, 0.0, 0.0];
    
    let results = hnsw.search_knn(&query, 10);
    assert!(results.is_empty());
}

#[test]
fn test_search_single_point() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    hnsw.add_point(1, vec![1.0, 0.0, 0.0]).unwrap();
    
    let results = hnsw.search_knn(&[0.9, 0.1, 0.0], 10);
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].0, 1);
}

#[test]
fn test_search_exact_match() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    
    // Add 3 orthogonal vectors
    hnsw.add_point(1, vec![1.0, 0.0, 0.0]).unwrap();
    hnsw.add_point(2, vec![0.0, 1.0, 0.0]).unwrap();
    hnsw.add_point(3, vec![0.0, 0.0, 1.0]).unwrap();
    
    // Query for exact match
    let results = hnsw.search_knn(&[1.0, 0.0, 0.0], 1);
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].0, 1);
    assert!((results[0].1 - 1.0).abs() < 1e-6); // Cosine sim = 1.0
}

#[test]
fn test_search_ordering() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    
    // Add vectors at different angles from query
    hnsw.add_point(1, vec![1.0, 0.0]).unwrap();   // Exact match
    hnsw.add_point(2, vec![0.707, 0.707]).unwrap(); // 45 degrees
    hnsw.add_point(3, vec![0.0, 1.0]).unwrap();   // 90 degrees
    
    let results = hnsw.search_knn(&[1.0, 0.0], 3);
    
    // Should be ordered by similarity (descending)
    assert_eq!(results[0].0, 1); // Closest
    assert_eq!(results[1].0, 2); // Middle
    assert_eq!(results[2].0, 3); // Farthest
}

#[test]
fn test_search_approximate_recall() {
    use std::collections::HashSet;
    
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    let dim = 128;
    let n = 1000;
    let k = 10;
    
    // Generate random vectors (deterministic seed via simple LCG)
    let mut seed: u64 = 42;
    let mut rng = || {
        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        (seed >> 33) as f32 / (u32::MAX as f32)
    };
    
    let mut vectors: Vec<Vec<f32>> = Vec::with_capacity(n);
    for i in 0..n {
        let v: Vec<f32> = (0..dim).map(|_| rng() - 0.5).collect();
        vectors.push(v.clone());
        hnsw.add_point(i as u32, v).unwrap();
    }
    
    // Run 10 queries and measure recall
    let mut total_recall = 0.0;
    let num_queries = 10;
    
    for q in 0..num_queries {
        let query: Vec<f32> = (0..dim).map(|_| rng() - 0.5).collect();
        
        // Brute force ground truth
        let mut ground_truth: Vec<(u32, f32)> = vectors.iter()
            .enumerate()
            .map(|(i, v)| (i as u32, cosine_sim(&query, v)))
            .collect();
        ground_truth.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        let gt_set: HashSet<u32> = ground_truth.iter().take(k).map(|(id, _)| *id).collect();
        
        // HNSW search
        let results = hnsw.search_knn(&query, k);
        let result_set: HashSet<u32> = results.iter().map(|(id, _)| *id).collect();
        
        // Calculate recall
        let hits = gt_set.intersection(&result_set).count();
        total_recall += hits as f32 / k as f32;
    }
    
    let avg_recall = total_recall / num_queries as f32;
    println!("Recall@10 = {:.4}", avg_recall);
    assert!(avg_recall > 0.5, "Recall@{} = {:.2}, expected > 0.5", k, avg_recall);
}

// ============================================================================
// Delete Tests
// ============================================================================

#[test]
fn test_delete_excludes_from_search() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    
    hnsw.add_point(1, vec![1.0, 0.0, 0.0]).unwrap();
    hnsw.add_point(2, vec![0.9, 0.1, 0.0]).unwrap();
    hnsw.add_point(3, vec![0.0, 1.0, 0.0]).unwrap();
    
    // Delete point 1
    hnsw.delete_point(1);
    
    // Search should not return deleted point
    let results = hnsw.search_knn(&[1.0, 0.0, 0.0], 10);
    assert!(!results.iter().any(|(id, _)| *id == 1));
    assert_eq!(results[0].0, 2); // Next closest
}

#[test]
fn test_delete_nonexistent_is_noop() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    hnsw.add_point(1, vec![1.0, 0.0]).unwrap();
    
    // Should not panic
    hnsw.delete_point(999);
    assert_eq!(hnsw.len(), 1);
}

// ============================================================================
// Stress Tests
// ============================================================================

#[test]
fn test_10k_vectors_performance() {
    let mut hnsw = Hnsw::new(16, 100, Metric::Cosine);
    let dim = 384; // Typical embedding dimension
    let n = 10_000;
    
    // Simple deterministic random
    let mut seed: u64 = 12345;
    let mut rng = || {
        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        (seed >> 33) as f32 / (u32::MAX as f32) - 0.5
    };
    
    let start = std::time::Instant::now();
    
    for i in 0..n {
        let v: Vec<f32> = (0..dim).map(|_| rng()).collect();
        hnsw.add_point(i as u32, v).unwrap();
    }
    
    let insert_time = start.elapsed();
    
    // Search
    let query: Vec<f32> = (0..dim).map(|_| rng()).collect();
    let search_start = std::time::Instant::now();
    let results = hnsw.search_knn(&query, 10);
    let search_time = search_start.elapsed();
    
    assert_eq!(results.len(), 10);
    
    // Performance assertions (generous for CI/Debug)
    assert!(insert_time.as_secs() < 300, "Insert took {:?}", insert_time);
    assert!(search_time.as_millis() < 500, "Search took {:?}", search_time);
    
    println!("10k insert: {:?}, search: {:?}", insert_time, search_time);
}

// ============================================================================
// Helper
// ============================================================================

fn cosine_sim(a: &[f32], b: &[f32]) -> f32 {
    let dot: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
    let mag_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let mag_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if mag_a == 0.0 || mag_b == 0.0 { 0.0 } else { dot / (mag_a * mag_b) }
}
