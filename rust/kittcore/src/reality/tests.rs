use super::syntax::{RealityLanguage, SyntaxKind};
use super::parser::zip_reality;

#[derive(Debug, Clone)]
pub struct MockEntity {
    pub start: usize,
    pub end: usize,
    pub label: String,
    pub kind: String, // "Person", "Place", etc.
}

fn dump_tree(node: &rowan::SyntaxNode<RealityLanguage>) -> String {
    format!("{:#?}", node)
}

/// Helper to find the first descendant of a given kind
fn find_descendant(node: &rowan::SyntaxNode<RealityLanguage>, kind: SyntaxKind) -> Option<rowan::SyntaxNode<RealityLanguage>> {
    node.descendants().find(|n| n.kind() == kind)
}

/// Helper to find all descendants of a given kind
fn find_all_descendants(node: &rowan::SyntaxNode<RealityLanguage>, kind: SyntaxKind) -> Vec<rowan::SyntaxNode<RealityLanguage>> {
    node.descendants().filter(|n| n.kind() == kind).collect()
}

#[test]
fn test_zipper_basic_text() {
    // Contract: Pure text becomes a document with a paragraph with words
    let input = "Hello world.";
    let entities: Vec<MockEntity> = vec![];
    
    let result = zip_reality(input, &entities);
    let root = rowan::SyntaxNode::new_root(result);
    let output = dump_tree(&root);
    
    // With sentence detection, structure is now:
    // Document -> Paragraph -> Sentence -> Word...
    assert!(output.contains("Document"));
    assert!(output.contains("Paragraph"));
    assert!(output.contains("Word"));
    // New: Should also have Sentence nodes
    assert!(output.contains("Sentence"), "Should detect sentences");
}

#[test]
fn test_zipper_with_simple_entity() {
    // Contract: Text wrapped in an entity creates an EntitySpan node
    let input = "Hello Rust.";
    let entities = vec![
        MockEntity { start: 6, end: 10, label: "Rust".to_string(), kind: "Language".to_string() }
    ];
    
    let result = zip_reality(input, &entities);
    let root = rowan::SyntaxNode::new_root(result);
    let output = dump_tree(&root);

    assert!(output.contains("EntitySpan"));
    // The word "Rust" should be inside the EntitySpan
}

#[test]
fn test_zipper_nested_entity() {
    // Contract: Entities inside other entities become children nodes
    let input = "The University of California is big.";
    // Outer: University of California (4..28)
    // Inner: California (18..28)
    let entities = vec![
        MockEntity { start: 4, end: 28, label: "University of California".to_string(), kind: "Org".to_string() },
        MockEntity { start: 18, end: 28, label: "California".to_string(), kind: "Place".to_string() }
    ];
    
    let result = zip_reality(input, &entities);
    let root = rowan::SyntaxNode::new_root(result);
    let output = dump_tree(&root);
    
    // Find all EntitySpan nodes in the tree
    let entity_spans = find_all_descendants(&root, SyntaxKind::EntitySpan);
    
    assert_eq!(entity_spans.len(), 2, "Should have 2 entity spans (outer and inner). Tree:\n{}", output);
    
    // The outer entity should contain the inner entity
    let outer = &entity_spans[0];
    let has_child_entity = outer.children().any(|n| n.kind() == SyntaxKind::EntitySpan);
    
    assert!(has_child_entity, "Outer entity should contain inner entity node. Tree:\n{}", output);
}

#[derive(Debug, Clone)]
enum MockSpan {
    Entity(MockEntity),
    Relation { start: usize, end: usize, _kind: String },
}

impl super::parser::SemanticSpan for MockSpan {
    fn start(&self) -> usize {
        match self {
            MockSpan::Entity(e) => e.start,
            MockSpan::Relation { start, .. } => *start,
        }
    }
    fn end(&self) -> usize {
        match self {
            MockSpan::Entity(e) => e.end,
            MockSpan::Relation { end, .. } => *end,
        }
    }
    fn syntax_kind(&self) -> SyntaxKind {
        match self {
            MockSpan::Entity(_) => SyntaxKind::EntitySpan,
            MockSpan::Relation { .. } => SyntaxKind::RelationSpan,
        }
    }
}

#[test]
fn test_zipper_with_relation_span() {
    // Contract: [Entity] [Relation] [Entity]
    let input = "Frodo owns Sting.";
    // Frodo: 0..5
    // owns: 6..10
    // Sting: 11..16
    let spans = vec![
        MockSpan::Entity(MockEntity { start: 0, end: 5, label: "Frodo".to_string(), kind: "Person".to_string() }),
        MockSpan::Relation { start: 6, end: 10, _kind: "OWNS".to_string() },
        MockSpan::Entity(MockEntity { start: 11, end: 16, label: "Sting".to_string(), kind: "Item".to_string() }),
    ];
    
    let result = zip_reality(input, &spans);
    let root = rowan::SyntaxNode::new_root(result);
    let output = dump_tree(&root);
    
    assert!(output.contains("EntitySpan"), "Should have EntitySpan");
    assert!(output.contains("RelationSpan"), "Should have RelationSpan");
    
    // Find the sentence node (which now contains the entities/relations)
    let sentence = find_descendant(&root, SyntaxKind::Sentence)
        .expect("Should have sentence");
    
    // Validate adjacency in sentence children
    let children: Vec<_> = sentence.children().collect();
    
    let semantic_order: Vec<&str> = children.iter()
        .filter_map(|n| {
            if n.kind() == SyntaxKind::EntitySpan { Some("E") }
            else if n.kind() == SyntaxKind::RelationSpan { Some("R") }
            else { None }
        })
        .collect();
        
    assert_eq!(semantic_order, vec!["E", "R", "E"], "Order should be Entity-Relation-Entity");
}

#[test]
fn test_projection_triples() {
    use super::projection::project_triples;
    
    let input = "Frodo the hobbit owns Sting.";
    // Spans: Frodo (Entity), owns (Relation), Sting (Entity)
    // "the hobbit" are just words.
    let spans = vec![
        MockSpan::Entity(MockEntity { start: 0, end: 5, label: "Frodo".to_string(), kind: "Person".to_string() }),
        MockSpan::Relation { start: 17, end: 21, _kind: "OWNS".to_string() }, // "owns"
        MockSpan::Entity(MockEntity { start: 22, end: 27, label: "Sting".to_string(), kind: "Item".to_string() }),
    ];
    
    let result = zip_reality(input, &spans);
    let root = rowan::SyntaxNode::new_root(result);
    let output = dump_tree(&root);
    
    let triples = project_triples(&root);
    
    assert_eq!(triples.len(), 1, "Should extract 1 triple. Tree:\n{}", output);
    assert_eq!(triples[0].source, "Frodo");
    assert_eq!(triples[0].relation, "owns");
    assert_eq!(triples[0].target, "Sting");
}
