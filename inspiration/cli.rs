use crate::channel::Channel;
use crate::data_store::DataStore;
use crate::search;
use crate::track::Track;
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "r4")]
#[command(about = "radio4000 desktop browser", long_about = None)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Search channels or tracks
    Search {
        /// Query string
        query: String,

        /// Target: channels or tracks
        #[arg(short, long, default_value = "tracks")]
        target: String,

        /// Output format: text or json
        #[arg(short, long, default_value = "text")]
        format: String,

        /// Maximum number of results
        #[arg(short, long)]
        limit: Option<usize>,
    },

    /// Show statistics about the data
    Stats {
        /// Output format: text or json
        #[arg(short, long, default_value = "text")]
        format: String,
    },

    /// Filter tracks or channels
    Filter {
        /// Filter by tag
        #[arg(long)]
        tag: Option<String>,

        /// Filter by channel slug
        #[arg(long)]
        channel: Option<String>,

        /// Output format: text or json
        #[arg(short, long, default_value = "text")]
        format: String,

        /// Maximum number of results
        #[arg(short, long)]
        limit: Option<usize>,
    },

    /// Run the data import pipeline
    Import,
}

pub fn run(cli: Cli) -> Result<(), Box<dyn std::error::Error>> {
    match cli.command {
        Some(Commands::Import) => {
            r4::import::run()?;
        }
        Some(Commands::Search {
            query,
            target,
            format,
            limit,
        }) => {
            let data = DataStore::load();
            match target.as_str() {
                "channels" => search_channels(&data.channels, &query, &format, limit),
                "tracks" => search_tracks(&data.tracks, &query, &format, limit),
                _ => {
                    eprintln!("Invalid target. Use 'channels' or 'tracks'");
                    std::process::exit(1);
                }
            }
        }
        Some(Commands::Stats { format }) => {
            let data = DataStore::load();
            show_stats(&data, &format);
        }
        Some(Commands::Filter {
            tag,
            channel,
            format,
            limit,
        }) => {
            let data = DataStore::load();
            filter_data(&data, tag, channel, &format, limit);
        }
        None => {
            eprintln!("No command provided. Use --help for usage information.");
            std::process::exit(1);
        }
    }

    Ok(())
}

fn search_channels(channels: &[Channel], query: &str, format: &str, limit: Option<usize>) {
    let mut matcher = search::ChannelMatcher::new();
    matcher.update_items(channels);
    matcher.set_pattern(query);

    let matched_indices = matcher.get_matched_indices();
    let results: Vec<&Channel> = matched_indices
        .iter()
        .take(limit.unwrap_or(usize::MAX))
        .filter_map(|&idx| channels.get(idx))
        .collect();

    match format {
        "json" => {
            println!("{}", serde_json::to_string_pretty(&results).unwrap());
        }
        _ => {
            println!("Found {} channels:\n", results.len());
            for channel in results {
                println!("{} (@{})", channel.name, channel.slug);
                if !channel.metadata.tags.is_empty() {
                    println!("  tags: {}", channel.metadata.tags.join(", "));
                }
                println!("  {} tracks\n", channel.track_count);
            }
        }
    }
}

fn search_tracks(tracks: &[Track], query: &str, format: &str, limit: Option<usize>) {
    let mut matcher = search::TrackMatcher::new();
    matcher.update_items(tracks);
    matcher.set_pattern(query);

    let matched_indices = matcher.get_matched_indices();
    let results: Vec<&Track> = matched_indices
        .iter()
        .take(limit.unwrap_or(usize::MAX))
        .filter_map(|&idx| tracks.get(idx))
        .collect();

    match format {
        "json" => {
            println!("{}", serde_json::to_string_pretty(&results).unwrap());
        }
        _ => {
            println!("Found {} tracks:\n", results.len());
            for track in results {
                println!("{}", track.title);
                if !track.description.is_empty() {
                    println!("  {}", track.description);
                }
                println!("  @{}", track.slug);
                println!("  {}\n", track.url);
            }
        }
    }
}

fn show_stats(data: &DataStore, format: &str) {
    let total_channels = data.channels.len();
    let total_tracks = data.tracks.len();

    let avg_tracks_per_channel = if total_channels > 0 {
        total_tracks as f64 / total_channels as f64
    } else {
        0.0
    };

    let channels_with_tracks = data.channels.iter().filter(|c| c.track_count > 0).count();

    match format {
        "json" => {
            let stats = serde_json::json!({
                "channels": {
                    "total": total_channels,
                    "with_tracks": channels_with_tracks,
                },
                "tracks": {
                    "total": total_tracks,
                },
                "averages": {
                    "tracks_per_channel": format!("{:.2}", avg_tracks_per_channel),
                }
            });
            println!("{}", serde_json::to_string_pretty(&stats).unwrap());
        }
        _ => {
            println!("radio4000 statistics\n");
            println!("channels:");
            println!("  total:        {}", total_channels);
            println!("  with tracks:  {}", channels_with_tracks);
            println!();
            println!("tracks:");
            println!("  total:        {}", total_tracks);
            println!();
            println!("averages:");
            println!("  tracks/channel: {:.2}", avg_tracks_per_channel);
        }
    }
}

fn filter_data(
    data: &DataStore,
    tag: Option<String>,
    channel_slug: Option<String>,
    format: &str,
    limit: Option<usize>,
) {
    let mut tracks: Vec<&Track> = data.tracks.iter().collect();

    if let Some(tag_filter) = tag {
        tracks.retain(|t| {
            t.metadata
                .tags
                .iter()
                .any(|t| t.to_lowercase() == tag_filter.to_lowercase())
        });
    }

    if let Some(slug_filter) = channel_slug {
        tracks.retain(|t| t.slug == slug_filter);
    }

    let results: Vec<&Track> = tracks
        .into_iter()
        .take(limit.unwrap_or(usize::MAX))
        .collect();

    match format {
        "json" => {
            println!("{}", serde_json::to_string_pretty(&results).unwrap());
        }
        _ => {
            println!("Found {} tracks:\n", results.len());
            for track in results {
                println!("{}", track.title);
                if !track.description.is_empty() {
                    println!("  {}", track.description);
                }
                println!("  @{}", track.slug);
                if !track.metadata.tags.is_empty() {
                    println!("  tags: {}", track.metadata.tags.join(", "));
                }
                println!("  {}\n", track.url);
            }
        }
    }
}
