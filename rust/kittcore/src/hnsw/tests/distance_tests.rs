use crate::hnsw::distance::{cosine_similarity, euclidean_distance_squared, magnitude};

#[test]
fn test_cosine_identical_vectors() {
    let v = vec![1.0, 0.0, 0.0];
    assert!((cosine_similarity(&v, &v, None, None) - 1.0).abs() < 1e-6);
}

#[test]
fn test_cosine_orthogonal_vectors() {
    let a = vec![1.0, 0.0];
    let b = vec![0.0, 1.0];
    // Dot product 0 -> cosine sim 0
    assert!((cosine_similarity(&a, &b, None, None)).abs() < 1e-6);
}

#[test]
fn test_cosine_opposite_vectors() {
    let a = vec![1.0, 0.0];
    let b = vec![-1.0, 0.0];
    assert!((cosine_similarity(&a, &b, None, None) - (-1.0)).abs() < 1e-6);
}

#[test]
fn test_cosine_with_precomputed_magnitude() {
    let a = vec![3.0, 4.0]; // mag 5
    let b = vec![6.0, 8.0]; // mag 10
    // Dot = 18 + 32 = 50.
    // Denom = 5 * 10 = 50.
    // Sim = 1.0
    
    let mag_a = 5.0;
    let mag_b = 10.0;
    
    let sim = cosine_similarity(&a, &b, Some(mag_a), Some(mag_b));
    assert!((sim - 1.0).abs() < 1e-6);
}

#[test]
fn test_euclidean_distance_squared() {
    let a = vec![1.0, 2.0];
    let b = vec![4.0, 6.0];
    // dx=3, dy=4. sq = 9+16=25.
    assert!((euclidean_distance_squared(&a, &b) - 25.0).abs() < 1e-6);
}

#[test]
fn test_magnitude() {
    let v = vec![3.0, 4.0];
    assert!((magnitude(&v) - 5.0).abs() < 1e-6);
}

#[test]
fn test_loop_unrolling_matches_naive() {
    // Test with a vector length that triggers unrolling (>= 4) and handles remainder
    let a = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    let b = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    
    let dist = euclidean_distance_squared(&a, &b);
    assert!(dist < 1e-6);
}
