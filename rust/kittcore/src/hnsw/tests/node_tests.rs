use crate::hnsw::node::HnswNode;

#[test]
fn test_node_creation() {
    let vector = vec![1.0, 2.0, 3.0];
    let node = HnswNode::new(1, 0, vector.clone(), 3); // id, level, vector, max_layers

    assert_eq!(node.id, 1);
    assert_eq!(node.level, 0);
    assert_eq!(node.vector, vector);
    assert!(!node.deleted);
    // Neighbors should be initialized for at least the given level or 0? 
    // Usually HNSW nodes have a max level assigned at creation.
    // If level is 0, it means it exists at layer 0.
    // The `neighbors` field is `Vec<Vec<i32>>`.
}

#[test]
fn test_magnitude_caching() {
    let vector = vec![3.0, 4.0]; // Mag = 5.0
    let node = HnswNode::new(2, 0, vector, 1);

    // Initial state might be None if lazy, or computed if eager.
    // User struct has Cell<Option<f32>>, implying lazy.
    
    // First access
    let mag = node.get_magnitude();
    assert_eq!(mag, 5.0);

    // Verify it's cached? We can't easily peek inside Cell without method, 
    // but we can ensure subsequent calls work.
    assert_eq!(node.get_magnitude(), 5.0);
}

#[test]
fn test_normalized_vector() {
    let vector = vec![3.0, 0.0, 4.0]; // Mag 5.
    let node = HnswNode::new(3, 0, vector, 1);

    let norm_opt = node.get_normalized();
    assert!(norm_opt.is_some());
    let norm = norm_opt.unwrap();
    
    assert!((norm[0] - 0.6).abs() < 1e-6);
    assert!((norm[1] - 0.0).abs() < 1e-6);
    assert!((norm[2] - 0.8).abs() < 1e-6);
    
    // Cached check
    let norm2 = node.get_normalized().unwrap();
    assert_eq!(norm, norm2);
}

#[test]
fn test_neighbor_operations() {
    let vector = vec![1.0];
    let mut node = HnswNode::new(4, 2, vector, 3); // Max level 2 (3 layers: 0, 1, 2)

    // Initially empty?
    assert!(node.neighbors.len() >= 3);

    // Add neighbor to layer 1
    node.add_neighbor(1, 100);
    assert!(node.neighbors[1].contains(&100));

    // Add neighbor to layer 0
    node.add_neighbor(0, 101);
    assert!(node.neighbors[0].contains(&101));
}
