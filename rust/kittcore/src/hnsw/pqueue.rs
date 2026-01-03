use std::cmp::Ordering;

#[derive(Debug, Clone)]
pub struct ScoredItem<T> {
    pub score: f32,
    pub item: T,
}

impl<T> PartialEq for ScoredItem<T> {
    fn eq(&self, other: &Self) -> bool {
        // We only care about score for ordering
        self.score == other.score
    }
}

impl<T> Eq for ScoredItem<T> {}

impl<T> PartialOrd for ScoredItem<T> {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl<T> Ord for ScoredItem<T> {
    fn cmp(&self, other: &Self) -> Ordering {
        // Handle NaN/Infinity if strictly needed, but for HNSW scores are usually well-behaved.
        // We defer to partial_cmp of f32, defaulting to Equal if None (NaN).
        // Since we want a total ordering, we must handle NaN. 
        // We'll treat NaN as Equal.
        self.score.partial_cmp(&other.score).unwrap_or(Ordering::Equal)
    }
}
