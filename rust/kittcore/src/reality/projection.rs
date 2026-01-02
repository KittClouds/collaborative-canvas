use rowan::SyntaxNode;
use super::syntax::{RealityLanguage, SyntaxKind};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Triple {
    pub source: String,
    pub relation: String,
    pub target: String,
    /// Byte range of the source entity (start, end)
    pub source_span: Option<(usize, usize)>,
    /// Byte range of the target entity (start, end)
    pub target_span: Option<(usize, usize)>,
}

pub fn project_triples(root: &SyntaxNode<RealityLanguage>) -> Vec<Triple> {
    let mut triples = Vec::new();
    
    for descendant in root.descendants() {
        if descendant.kind() == SyntaxKind::RelationSpan {
            // Find Subject (Left) and Object (Right)
            let subject = find_neighbor_entity(&descendant, Direction::Left);
            let object = find_neighbor_entity(&descendant, Direction::Right);
            
            if let (Some(s), Some(o)) = (subject, object) {
                let source_range = s.text_range();
                let target_range = o.text_range();
                
                triples.push(Triple {
                    source: s.text().to_string(),
                    relation: descendant.text().to_string(),
                    target: o.text().to_string(),
                    source_span: Some((source_range.start().into(), source_range.end().into())),
                    target_span: Some((target_range.start().into(), target_range.end().into())),
                });
            }
        }
    }
    
    triples
}

enum Direction {
    Left,
    Right,
}

fn find_neighbor_entity(node: &SyntaxNode<RealityLanguage>, dir: Direction) -> Option<SyntaxNode<RealityLanguage>> {
    let mut current = node.clone();
    
    loop {
        let next = match dir {
            Direction::Left => current.prev_sibling(),
            Direction::Right => current.next_sibling(),
        };
        
        match next {
            Some(sibling) => {
                let kind = sibling.kind();
                if kind == SyntaxKind::EntitySpan {
                    return Some(sibling);
                }
                
                // Allow skipping Trivia
                if is_trivia(kind) {
                    current = sibling;
                    continue;
                }
                
                // If we hit another Relation or strict Sentence boundary, maybe stop?
                if kind == SyntaxKind::RelationSpan {
                     return None;
                }
                 current = sibling;
            }
            None => return None,
        }
    }
}

fn is_trivia(kind: SyntaxKind) -> bool {
    kind == SyntaxKind::Whitespace || kind == SyntaxKind::Punctuation || kind == SyntaxKind::Word
}
