//! Metadata Filtering for HNSW Search
//!
//! Enables hard constraints during vector search (e.g., "only notes tagged 'Rust'").
//! Filters are applied during graph traversal for correctness.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Metadata value types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum MetaValue {
    String(String),
    Number(f64),
    Bool(bool),
    Array(Vec<String>),
}

impl MetaValue {
    pub fn as_str(&self) -> Option<&str> {
        match self {
            MetaValue::String(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_f64(&self) -> Option<f64> {
        match self {
            MetaValue::Number(n) => Some(*n),
            _ => None,
        }
    }

    pub fn as_bool(&self) -> Option<bool> {
        match self {
            MetaValue::Bool(b) => Some(*b),
            _ => None,
        }
    }

    pub fn contains(&self, value: &str) -> bool {
        match self {
            MetaValue::Array(arr) => arr.iter().any(|v| v == value),
            MetaValue::String(s) => s == value,
            _ => false,
        }
    }
}

/// A single filter condition
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "op")]
pub enum FilterCondition {
    /// Exact equality: field == value
    #[serde(rename = "eq")]
    Eq { field: String, value: MetaValue },

    /// Not equal: field != value
    #[serde(rename = "neq")]
    Neq { field: String, value: MetaValue },

    /// Field value is in list
    #[serde(rename = "in")]
    In { field: String, values: Vec<String> },

    /// Numeric range: min <= field <= max
    #[serde(rename = "range")]
    Range { field: String, min: Option<f64>, max: Option<f64> },

    /// Field contains value (for arrays or strings)
    #[serde(rename = "contains")]
    Contains { field: String, value: String },

    /// Boolean AND of conditions
    #[serde(rename = "and")]
    And { conditions: Vec<FilterCondition> },

    /// Boolean OR of conditions
    #[serde(rename = "or")]
    Or { conditions: Vec<FilterCondition> },
}

impl FilterCondition {
    /// Evaluate this filter against a metadata map
    pub fn matches(&self, meta: &HashMap<String, MetaValue>) -> bool {
        match self {
            FilterCondition::Eq { field, value } => {
                meta.get(field).map(|v| v == value).unwrap_or(false)
            }

            FilterCondition::Neq { field, value } => {
                meta.get(field).map(|v| v != value).unwrap_or(true)
            }

            FilterCondition::In { field, values } => {
                meta.get(field)
                    .and_then(|v| v.as_str())
                    .map(|s| values.iter().any(|val| val == s))
                    .unwrap_or(false)
            }

            FilterCondition::Range { field, min, max } => {
                meta.get(field)
                    .and_then(|v| v.as_f64())
                    .map(|n| {
                        let above_min = min.map(|m| n >= m).unwrap_or(true);
                        let below_max = max.map(|m| n <= m).unwrap_or(true);
                        above_min && below_max
                    })
                    .unwrap_or(false)
            }

            FilterCondition::Contains { field, value } => {
                meta.get(field).map(|v| v.contains(value)).unwrap_or(false)
            }

            FilterCondition::And { conditions } => {
                conditions.iter().all(|c| c.matches(meta))
            }

            FilterCondition::Or { conditions } => {
                conditions.iter().any(|c| c.matches(meta))
            }
        }
    }
}

/// Builder for creating filters fluently
pub struct FilterBuilder {
    conditions: Vec<FilterCondition>,
}

impl FilterBuilder {
    pub fn new() -> Self {
        Self { conditions: Vec::new() }
    }

    pub fn eq(mut self, field: &str, value: impl Into<MetaValue>) -> Self {
        self.conditions.push(FilterCondition::Eq {
            field: field.to_string(),
            value: value.into(),
        });
        self
    }

    pub fn neq(mut self, field: &str, value: impl Into<MetaValue>) -> Self {
        self.conditions.push(FilterCondition::Neq {
            field: field.to_string(),
            value: value.into(),
        });
        self
    }

    pub fn in_list(mut self, field: &str, values: Vec<String>) -> Self {
        self.conditions.push(FilterCondition::In {
            field: field.to_string(),
            values,
        });
        self
    }

    pub fn range(mut self, field: &str, min: Option<f64>, max: Option<f64>) -> Self {
        self.conditions.push(FilterCondition::Range {
            field: field.to_string(),
            min,
            max,
        });
        self
    }

    pub fn contains(mut self, field: &str, value: &str) -> Self {
        self.conditions.push(FilterCondition::Contains {
            field: field.to_string(),
            value: value.to_string(),
        });
        self
    }

    pub fn build(self) -> Option<FilterCondition> {
        match self.conditions.len() {
            0 => None,
            1 => Some(self.conditions.into_iter().next().unwrap()),
            _ => Some(FilterCondition::And { conditions: self.conditions }),
        }
    }
}

impl From<String> for MetaValue {
    fn from(s: String) -> Self {
        MetaValue::String(s)
    }
}

impl From<&str> for MetaValue {
    fn from(s: &str) -> Self {
        MetaValue::String(s.to_string())
    }
}

impl From<f64> for MetaValue {
    fn from(n: f64) -> Self {
        MetaValue::Number(n)
    }
}

impl From<i32> for MetaValue {
    fn from(n: i32) -> Self {
        MetaValue::Number(n as f64)
    }
}

impl From<bool> for MetaValue {
    fn from(b: bool) -> Self {
        MetaValue::Bool(b)
    }
}

impl From<Vec<String>> for MetaValue {
    fn from(arr: Vec<String>) -> Self {
        MetaValue::Array(arr)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_meta() -> HashMap<String, MetaValue> {
        let mut m = HashMap::new();
        m.insert("type".to_string(), MetaValue::String("meeting".to_string()));
        m.insert("year".to_string(), MetaValue::Number(2024.0));
        m.insert("priority".to_string(), MetaValue::Number(5.0));
        m.insert("archived".to_string(), MetaValue::Bool(false));
        m.insert("tags".to_string(), MetaValue::Array(vec!["rust".to_string(), "ai".to_string()]));
        m
    }

    #[test]
    fn test_eq_string() {
        let meta = make_meta();
        let filter = FilterCondition::Eq {
            field: "type".to_string(),
            value: MetaValue::String("meeting".to_string()),
        };
        assert!(filter.matches(&meta));

        let filter_miss = FilterCondition::Eq {
            field: "type".to_string(),
            value: MetaValue::String("note".to_string()),
        };
        assert!(!filter_miss.matches(&meta));
    }

    #[test]
    fn test_eq_number() {
        let meta = make_meta();
        let filter = FilterCondition::Eq {
            field: "year".to_string(),
            value: MetaValue::Number(2024.0),
        };
        assert!(filter.matches(&meta));
    }

    #[test]
    fn test_neq() {
        let meta = make_meta();
        let filter = FilterCondition::Neq {
            field: "type".to_string(),
            value: MetaValue::String("note".to_string()),
        };
        assert!(filter.matches(&meta));

        let filter_miss = FilterCondition::Neq {
            field: "type".to_string(),
            value: MetaValue::String("meeting".to_string()),
        };
        assert!(!filter_miss.matches(&meta));
    }

    #[test]
    fn test_in() {
        let meta = make_meta();
        let filter = FilterCondition::In {
            field: "type".to_string(),
            values: vec!["meeting".to_string(), "task".to_string()],
        };
        assert!(filter.matches(&meta));

        let filter_miss = FilterCondition::In {
            field: "type".to_string(),
            values: vec!["note".to_string(), "task".to_string()],
        };
        assert!(!filter_miss.matches(&meta));
    }

    #[test]
    fn test_range() {
        let meta = make_meta();

        // Full range
        let filter = FilterCondition::Range {
            field: "year".to_string(),
            min: Some(2020.0),
            max: Some(2025.0),
        };
        assert!(filter.matches(&meta));

        // Min only
        let filter_min = FilterCondition::Range {
            field: "year".to_string(),
            min: Some(2023.0),
            max: None,
        };
        assert!(filter_min.matches(&meta));

        // Max only
        let filter_max = FilterCondition::Range {
            field: "year".to_string(),
            min: None,
            max: Some(2024.0),
        };
        assert!(filter_max.matches(&meta));

        // Out of range
        let filter_miss = FilterCondition::Range {
            field: "year".to_string(),
            min: Some(2025.0),
            max: Some(2030.0),
        };
        assert!(!filter_miss.matches(&meta));
    }

    #[test]
    fn test_contains() {
        let meta = make_meta();
        let filter = FilterCondition::Contains {
            field: "tags".to_string(),
            value: "rust".to_string(),
        };
        assert!(filter.matches(&meta));

        let filter_miss = FilterCondition::Contains {
            field: "tags".to_string(),
            value: "python".to_string(),
        };
        assert!(!filter_miss.matches(&meta));
    }

    #[test]
    fn test_and() {
        let meta = make_meta();
        let filter = FilterCondition::And {
            conditions: vec![
                FilterCondition::Eq {
                    field: "type".to_string(),
                    value: MetaValue::String("meeting".to_string()),
                },
                FilterCondition::Range {
                    field: "year".to_string(),
                    min: Some(2020.0),
                    max: None,
                },
            ],
        };
        assert!(filter.matches(&meta));
    }

    #[test]
    fn test_or() {
        let meta = make_meta();
        let filter = FilterCondition::Or {
            conditions: vec![
                FilterCondition::Eq {
                    field: "type".to_string(),
                    value: MetaValue::String("note".to_string()),
                },
                FilterCondition::Eq {
                    field: "type".to_string(),
                    value: MetaValue::String("meeting".to_string()),
                },
            ],
        };
        assert!(filter.matches(&meta));
    }

    #[test]
    fn test_builder() {
        let meta = make_meta();
        let filter = FilterBuilder::new()
            .eq("type", "meeting")
            .range("priority", Some(1.0), Some(10.0))
            .build()
            .unwrap();
        
        assert!(filter.matches(&meta));
    }

    #[test]
    fn test_missing_field() {
        let meta = make_meta();
        let filter = FilterCondition::Eq {
            field: "nonexistent".to_string(),
            value: MetaValue::String("anything".to_string()),
        };
        assert!(!filter.matches(&meta));
    }
}
