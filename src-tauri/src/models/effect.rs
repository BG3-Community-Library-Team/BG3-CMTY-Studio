//! Toolkit effect data model — represents the domain-specific `.lsefx` structure.
//!
//! This is the in-memory representation of what the BG3 Toolkit saves and opens
//! for visual effects. The runtime counterpart (`.lsfx` binary) is represented
//! as a generic [`LsxResource`] from the LSF parser.

/// A keyframe in an animation channel.
#[derive(Debug, Clone)]
pub struct Keyframe {
    pub time: String,
    pub value: String,
    pub interpolation: Option<String>,
}

/// A single animation channel within ramp data.
#[derive(Debug, Clone)]
pub struct RampChannel {
    pub channel_type: String, // "Linear", "Spline", etc.
    pub id: String,           // UUID
    pub selected: bool,
    pub keyframes: Vec<Keyframe>,
}

/// Container for multiple animation channels on a single property.
#[derive(Debug, Clone)]
pub struct RampChannelData {
    pub channels: Vec<RampChannel>,
}

/// Per-platform metadata for a property in the `.lsefx` format.
#[derive(Debug, Clone)]
pub struct PlatformMetadata {
    pub platform: String,
    pub expanded: String,
}

/// A single datum value (or ramp channel data) for a property.
#[derive(Debug, Clone)]
pub struct Datum {
    pub platform: String,
    pub lod: String,
    pub value: Option<String>,
    pub ramp_channel_data: Option<RampChannelData>,
}

impl Default for Datum {
    fn default() -> Self {
        Self {
            platform: "00000000-0000-0000-0000-000000000000".to_string(),
            lod: "00000000-0000-0000-0000-000000000000".to_string(),
            value: None,
            ramp_channel_data: None,
        }
    }
}

/// A property on an effect component, identified by GUID.
#[derive(Debug, Clone)]
pub struct EffectProperty {
    pub guid: String,
    pub data: Vec<Datum>,
    pub platform_metadata: Vec<PlatformMetadata>,
}

/// A property group reference within a component.
#[derive(Debug, Clone)]
pub struct PropertyGroup {
    pub guid: String,
    pub name: String,
    pub collapsed: String,
}

/// A module reference within a component.
#[derive(Debug, Clone)]
pub struct EffectModule {
    pub guid: String,
    pub muted: String,
    pub index: u32,
}

/// An effect component (e.g., BoundingSphere, ParticleSystem, Model).
#[derive(Debug, Clone)]
pub struct EffectComponent {
    pub class_name: String,
    pub start: String,
    pub end: String,
    pub instance_name: String,
    pub properties: Vec<EffectProperty>,
    pub property_groups: Vec<PropertyGroup>,
    pub modules: Vec<EffectModule>,
}

/// A track within a track group.
#[derive(Debug, Clone)]
pub struct Track {
    pub name: String,
    pub muted: String,
    pub locked: String,
    pub mute_state_override: String,
    pub components: Vec<EffectComponent>,
}

impl Default for Track {
    fn default() -> Self {
        Self {
            name: "Track".to_string(),
            muted: "False".to_string(),
            locked: "False".to_string(),
            mute_state_override: "Unmuted".to_string(),
            components: Vec::new(),
        }
    }
}

/// An identifier within a track group.
#[derive(Debug, Clone)]
pub struct TrackGroupId {
    pub value: String,
}

/// A track group containing one or more tracks.
#[derive(Debug, Clone)]
pub struct TrackGroup {
    pub name: String,
    pub ids: Vec<TrackGroupId>,
    pub tracks: Vec<Track>,
}

impl Default for TrackGroup {
    fn default() -> Self {
        Self {
            name: "New Track Group".to_string(),
            ids: Vec::new(),
            tracks: Vec::new(),
        }
    }
}

/// Top-level effect resource — the `.lsefx` document model.
#[derive(Debug, Clone)]
pub struct EffectResource {
    pub version: String,
    pub effect_version: String,
    pub id: String,
    /// Opaque XML snippets for `<phases>` children (preserved for round-trip fidelity).
    pub phases_xml: String,
    /// Opaque XML snippets for `<colors>` children (preserved for round-trip fidelity).
    pub colors_xml: String,
    pub track_groups: Vec<TrackGroup>,
}

impl Default for EffectResource {
    fn default() -> Self {
        Self {
            version: "0.0".to_string(),
            effect_version: "1.0.0".to_string(),
            id: "00000000-0000-0000-0000-000000000000".to_string(),
            phases_xml: String::new(),
            colors_xml: String::new(),
            track_groups: Vec::new(),
        }
    }
}
