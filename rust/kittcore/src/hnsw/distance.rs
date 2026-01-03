pub fn magnitude(v: &[f32]) -> f32 {
    let mut sum = 0.0;
    let n = v.len();
    let mut i = 0;
    
    // Unrolling 4
    while i + 3 < n {
        sum += v[i] * v[i] + v[i+1] * v[i+1] + v[i+2] * v[i+2] + v[i+3] * v[i+3];
        i += 4;
    }
    
    while i < n {
        sum += v[i] * v[i];
        i += 1;
    }
    
    sum.sqrt()
}

pub fn euclidean_distance_squared(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() {
        // In production code we might want to panic or return Result. 
        // For HNSW hot path we usually assume lengths match.
        // We will just process up to min length or panic.
        // Let's assume matching lengths for perf.
    }

    let mut sum = 0.0;
    let n = a.len();
    let mut i = 0;

    // Unrolling 4
    while i + 3 < n {
        let d0 = a[i] - b[i];
        let d1 = a[i+1] - b[i+1];
        let d2 = a[i+2] - b[i+2];
        let d3 = a[i+3] - b[i+3];
        sum += d0*d0 + d1*d1 + d2*d2 + d3*d3;
        i += 4;
    }

    // Remainder
    while i < n {
        let d = a[i] - b[i];
        sum += d*d;
        i += 1;
    }

    sum
}

pub fn cosine_similarity(a: &[f32], b: &[f32], mag_a: Option<f32>, mag_b: Option<f32>) -> f32 {
    let mut dot = 0.0;
    let n = a.len();
    let mut i = 0;

    // Unrolling 4
    while i + 3 < n {
        dot += a[i] * b[i] + a[i+1] * b[i+1] + a[i+2] * b[i+2] + a[i+3] * b[i+3];
        i += 4;
    }

    while i < n {
        dot += a[i] * b[i];
        i += 1;
    }

    let ma = match mag_a {
        Some(m) => m,
        None => magnitude(a),
    };
    
    let mb = match mag_b {
        Some(m) => m,
        None => magnitude(b),
    };

    if ma == 0.0 || mb == 0.0 {
        return 0.0;
    }

    dot / (ma * mb)
}
