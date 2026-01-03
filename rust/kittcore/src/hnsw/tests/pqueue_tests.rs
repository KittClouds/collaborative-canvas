use crate::hnsw::pqueue::ScoredItem;
use std::collections::BinaryHeap;
use std::cmp::Reverse;

#[test]
fn test_push_pop_ordering() {
    let mut heap = BinaryHeap::new();
    heap.push(ScoredItem { score: 1.0, item: 1 });
    heap.push(ScoredItem { score: 3.0, item: 3 });
    heap.push(ScoredItem { score: 2.0, item: 2 });
    
    // Max heap by default for BinaryHeap (pops largest element first)
    // If ScoredItem implementation of Ord follows score value:
    // 3.0 > 2.0 > 1.0
    
    let first = heap.pop().unwrap();
    assert_eq!(first.item, 3);
    assert_eq!(first.score, 3.0);
    
    let second = heap.pop().unwrap();
    assert_eq!(second.item, 2);
    
    let third = heap.pop().unwrap();
    assert_eq!(third.item, 1);
}

#[test]
fn test_peek_without_remove() {
    let mut heap = BinaryHeap::new();
    heap.push(ScoredItem { score: 10.0, item: "A" });
    
    assert_eq!(heap.peek().unwrap().item, "A");
    assert_eq!(heap.len(), 1);
}

#[test]
fn test_min_heap_vs_max_heap() {
    // Max Heap
    let mut max_heap = BinaryHeap::new();
    max_heap.push(ScoredItem { score: 1.0, item: 1 });
    max_heap.push(ScoredItem { score: 2.0, item: 2 });
    assert_eq!(max_heap.peek().unwrap().score, 2.0); // Largest score

    // Min Heap using Reverse
    let mut min_heap = BinaryHeap::new();
    min_heap.push(Reverse(ScoredItem { score: 1.0, item: 1 }));
    min_heap.push(Reverse(ScoredItem { score: 2.0, item: 2 }));
    
    // Peek gives smallest item (wrapped in Reverse)
    assert_eq!(min_heap.peek().unwrap().0.score, 1.0);
}

#[test]
fn test_empty_queue() {
    let mut heap: BinaryHeap<ScoredItem<i32>> = BinaryHeap::new();
    assert!(heap.peek().is_none());
    assert!(heap.pop().is_none());
}
