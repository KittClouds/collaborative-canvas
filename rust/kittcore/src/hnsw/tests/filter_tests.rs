//! Tests for Metadata Filtering in HNSW Search
//!
//! Tests filter conditions and filtered search integration.

use crate::hnsw::filter::{FilterCondition, FilterBuilder, MetaValue};
use crate::hnsw::index::{Hnsw, Metric};
use std::collections::HashMap;

// ============================================================================
// HNSW Filtered Search Tests
// ============================================================================

#[test]
fn test_filtered_search_even_only() {
    let mut hnsw = Hnsw::new(16, 100, Metric::Cosine);
    
    // Add 20 points, IDs 0-19
    for i in 0u32..20 {
        let v: Vec<f32> = (0..64).map(|j| (i as f32 * 0.1 + j as f32) / 100.0).collect();
        hnsw.add_point(i, v).unwrap();
    }
    
    let query: Vec<f32> = (0..64).map(|j| j as f32 / 100.0).collect();
    
    // Search for even IDs only
    let results = hnsw.search_knn_filtered(&query, 5, |id| id % 2 == 0);
    
    assert_eq!(results.len(), 5);
    for (id, _) in &results {
        assert!(id % 2 == 0, "Expected even ID, got {}", id);
    }
}

#[test]
fn test_filtered_search_high_ids() {
    let mut hnsw = Hnsw::new(16, 100, Metric::Cosine);
    
    for i in 0u32..50 {
        let v: Vec<f32> = (0..32).map(|j| (i as f32 + j as f32) / 100.0).collect();
        hnsw.add_point(i, v).unwrap();
    }
    
    let query: Vec<f32> = (0..32).map(|j| 25.0 + j as f32 / 100.0).collect();
    
    // Only include IDs >= 25
    let results = hnsw.search_knn_filtered(&query, 10, |id| id >= 25);
    
    assert!(!results.is_empty());
    for (id, _) in &results {
        assert!(*id >= 25, "Expected ID >= 25, got {}", id);
    }
}

#[test]
fn test_filtered_search_no_matches() {
    let mut hnsw = Hnsw::new(16, 100, Metric::Cosine);
    
    for i in 0u32..10 {
        let v: Vec<f32> = (0..16).map(|j| (i as f32 + j as f32) / 100.0).collect();
        hnsw.add_point(i, v).unwrap();
    }
    
    let query: Vec<f32> = (0..16).map(|j| j as f32 / 100.0).collect();
    
    // Filter that matches nothing
    let results = hnsw.search_knn_filtered(&query, 5, |_| false);
    
    assert!(results.is_empty());
}

#[test]
fn test_filtered_search_all_match() {
    let mut hnsw = Hnsw::new(16, 100, Metric::Cosine);
    
    for i in 0u32..10 {
        let v: Vec<f32> = (0..16).map(|j| (i as f32 + j as f32) / 100.0).collect();
        hnsw.add_point(i, v).unwrap();
    }
    
    let query: Vec<f32> = (0..16).map(|j| j as f32 / 100.0).collect();
    
    // Filter that matches everything
    let results = hnsw.search_knn_filtered(&query, 5, |_| true);
    
    assert_eq!(results.len(), 5);
}

// ============================================================================
// Filter Condition with Metadata Map Tests
// ============================================================================

#[test]
fn test_filtered_search_with_metadata_map() {
    let mut hnsw = Hnsw::new(16, 100, Metric::Cosine);
    
    // Create a metadata map
    let mut metadata: HashMap<u32, HashMap<String, MetaValue>> = HashMap::new();
    
    for i in 0u32..20 {
        let v: Vec<f32> = (0..32).map(|j| (i as f32 + j as f32) / 100.0).collect();
        hnsw.add_point(i, v).unwrap();
        
        let mut meta = HashMap::new();
        meta.insert("type".to_string(), 
            if i % 2 == 0 { MetaValue::String("meeting".to_string()) } 
            else { MetaValue::String("note".to_string()) }
        );
        meta.insert("priority".to_string(), MetaValue::Number((i % 5) as f64));
        metadata.insert(i, meta);
    }
    
    let query: Vec<f32> = (0..32).map(|j| j as f32 / 100.0).collect();
    
    // Create a filter for type == "meeting"
    let filter = FilterCondition::Eq {
        field: "type".to_string(),
        value: MetaValue::String("meeting".to_string()),
    };
    
    // Search with filter
    let results = hnsw.search_knn_filtered(&query, 5, |id| {
        metadata.get(&id).map(|m| filter.matches(m)).unwrap_or(false)
    });
    
    assert_eq!(results.len(), 5);
    for (id, _) in &results {
        // All results should be meetings (even IDs)
        assert!(id % 2 == 0, "Expected meeting (even ID), got {}", id);
    }
}

#[test]
fn test_filter_builder_integration() {
    let mut hnsw = Hnsw::new(16, 100, Metric::Cosine);
    
    let mut metadata: HashMap<u32, HashMap<String, MetaValue>> = HashMap::new();
    
    for i in 0u32..30 {
        let v: Vec<f32> = (0..32).map(|j| (i as f32 + j as f32) / 100.0).collect();
        hnsw.add_point(i, v).unwrap();
        
        let mut meta = HashMap::new();
        meta.insert("year".to_string(), MetaValue::Number(2020.0 + (i % 5) as f64));
        meta.insert("archived".to_string(), MetaValue::Bool(i > 15));
        metadata.insert(i, meta);
    }
    
    let query: Vec<f32> = (0..32).map(|j| j as f32 / 100.0).collect();
    
    // Build filter: year >= 2022 AND NOT archived
    let filter = FilterBuilder::new()
        .range("year", Some(2022.0), None)
        .eq("archived", false)
        .build()
        .unwrap();
    
    let results = hnsw.search_knn_filtered(&query, 5, |id| {
        metadata.get(&id).map(|m| filter.matches(m)).unwrap_or(false)
    });
    
    // Verify all results match criteria
    for (id, _) in &results {
        let meta = metadata.get(id).unwrap();
        let year = meta.get("year").unwrap().as_f64().unwrap();
        let archived = meta.get("archived").unwrap().as_bool().unwrap();
        
        assert!(year >= 2022.0, "Expected year >= 2022, got {}", year);
        assert!(!archived, "Expected not archived");
    }
}
