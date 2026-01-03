use std::cell::{Cell, RefCell};
use super::distance::magnitude;

#[derive(Debug)]
pub struct HnswNode {
    pub id: u32,
    pub level: u8,
    pub vector: Vec<f32>,
    pub neighbors: Vec<Vec<i32>>,
    pub deleted: bool,
    magnitude: Cell<Option<f32>>,
    normalized: RefCell<Option<Vec<f32>>>,
}

impl HnswNode {
    /// Creates a new HnswNode.
    /// `max_layers` specifies the number of layers to pre-allocate neighbor lists for.
    /// Usually `max_layers` corresponds to the node's assigned max level + 1.
    pub fn new(id: u32, level: u8, vector: Vec<f32>, max_layers: usize) -> Self {
        let neighbors = vec![Vec::new(); max_layers];
        
        HnswNode {
            id,
            level,
            vector,
            neighbors,
            deleted: false,
            magnitude: Cell::new(None),
            normalized: RefCell::new(None),
        }
    }

    pub fn get_magnitude(&self) -> f32 {
        if let Some(mag) = self.magnitude.get() {
            return mag;
        }
        let mag = magnitude(&self.vector);
        self.magnitude.set(Some(mag));
        mag
    }

    /// Returns a copy of the normalized vector.
    /// Caches the result internally.
    pub fn get_normalized(&self) -> Option<Vec<f32>> {
        // Since we return a Vec, we clone. 
        // If we returned a reference we'd need to use Ref/RefMut which might leak internal implementation details via types.
        // For now, returning a clone is safe and easy. 
        // A Cow or Arc might be better if we access this frequently without modifying.
        
        if let Some(ref norm) = *self.normalized.borrow() {
             return Some(norm.clone());
        }

        let mag = self.get_magnitude();
        if mag == 0.0 {
            return None;
        }

        let norm: Vec<f32> = self.vector.iter().map(|v| v / mag).collect();
        *self.normalized.borrow_mut() = Some(norm.clone());
        Some(norm)
    }

    pub fn add_neighbor(&mut self, layer: usize, neighbor_id: i32) {
        if layer < self.neighbors.len() {
            self.neighbors[layer].push(neighbor_id);
        }
        // If layer is out of bounds, we currently ignore it. 
        // In a real implementation this might indicate a logic error in the insertion algorithm.
    }
}
