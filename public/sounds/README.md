# Optional recorded sound effects

The game synthesises all its sounds, so this folder can stay empty.
To use real recordings instead, put audio files here and map them in `manifest.json`:

```json
{
  "bat": "bat_hit.mp3",
  "edge": "edge_nick.mp3",
  "bounce": "pitch_bounce.mp3",
  "stumps": "stumps.mp3",
  "catch": "catch.mp3",
  "cheer": "crowd_four.mp3",
  "roar": "crowd_six.mp3",
  "applause": "applause.mp3",
  "appeal": "howzat.mp3"
}
```

Any name you leave out keeps its synthesised sound. Supported formats: anything the browser can decode (mp3, ogg, wav, m4a).
