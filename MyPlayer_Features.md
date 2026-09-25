
# MyPlayer Features and Functions Documentation

## 1. Audio Playback Features

### 1.1 Basic Playback Controls
- **Play/Pause**: Support for controlling audio playback state through play/pause button
- **Previous/Next Track**: Switching between previous or next audio in the playlist
- **Progress Seeking**: Support for clicking on waveform to jump to specific position
- **Fast Forward/Rewind**: Configurable fast forward/rewind seconds (default 10 seconds)

### 1.2 Audio Loading and Decoding
- **MP3 File Support**: Only supports MP3 format audio files
- **Automatic Decoding**: Automatically decodes MP3 to WAV format for cross-browser compatibility
- **Caching Mechanism**: Decoded audio is cached to avoid repeated decoding
- **Error Handling**: Falls back to original URL playback when decoding fails

### 1.3 Playlist Management
- **Add Files**: Support for adding MP3 files to playlist via file picker or drag-and-drop
- **Remove Files**: Ability to remove specific audio from playlist
- **Select and Play**: Can select any audio in the playlist to play
- **Auto-play Option**: Option to automatically play after adding new files

## 2. Waveform Visualization Features

### 2.1 Waveform Display
- **Waveform Rendering**: Renders audio data as visual waveform
- **Multiple Waveform Modes**: Supports multiple waveform display modes (StackedWaveform, RowWaveform, etc.)
- **Real-time Updates**: Waveform updates in real-time during playback, showing current position
- **Zoom Support**: Supports waveform zooming to view details at different time granularities

### 2.2 Waveform Interaction
- **Click to Seek**: Clicking on waveform can jump to corresponding time point
- **Region Selection**: Supports selecting regions on waveform for loop playback
- **Loop Playback**: Can set repeat count after selecting a region

## 3. Clip Detection and Looping Features

### 3.1 Automatic Clip Detection
- **Silence Detection**: Automatically detects silent parts in audio
- **Clip Splitting**: Automatically splits audio into clips based on silent points
- **Parameter Configuration**: Configurable detection parameters (block size, silence ratio, minimum clip length, etc.)

### 3.2 Clip Loop Playback
- **Precise Positioning**: Supports precise setting of clip start and end positions
- **Repeat Control**: Can set the number of repetitions for a clip
- **Loop State Management**: Manages loop playback state to avoid UI misjudgment

## 4. User Interface Features

### 4.1 Player Interface
- **Current Playing Info**: Displays current audio title and artist
- **Progress Display**: Shows current playback progress and total duration
- **Control Buttons**: Provides intuitive playback control buttons
- **Playlist Sidebar**: Toggleable playlist sidebar
- **Settings Panel**: Provides application settings options

### 4.2 Notification System
- **Operation Feedback**: Provides operation success notification feedback
- **Error Messages**: Displays loading or playback error messages
- **Auto-dismiss**: Notification messages automatically disappear after a few seconds

### 4.3 Theme System
- **Multiple Themes**: Support for multiple visual themes
- **Theme Switching**: Users can switch application themes

## 5. File Handling Features

### 5.1 File Addition
- **Drag and Drop**: Supports dragging and dropping files to the application interface to add to playlist
- **File Picker**: Traditional file picker for adding files
- **Format Filtering**: Automatically filters non-MP3 format files
- **Batch Addition**: Supports adding multiple files at once

### 5.2 File Management
- **File References**: Uses URL.createObjectURL to create file references
- **Memory Management**: Properly releases file references when no longer needed

## 6. Configuration Management Features

### 6.1 User Settings
- **Skip Interval**: Configurable seconds for fast forward/rewind
- **Waveform Display Mode**: Can choose different waveform display modes
- **Clip Detection Parameters**: Configurable silence detection parameters
- **Setting Persistence**: Settings automatically saved to local storage

### 6.2 State Management
- **Redux State Management**: Uses Redux for centralized application state management
- **State Selectors**: Provides efficient state access methods
- **State Persistence**: Key states saved to local storage

## 7. Accessibility Features

### 7.1 Keyboard Shortcuts
- **Play/Pause**: Space bar support for toggling play/pause
- **Previous/Next**: Support for switching previous/next track
- **Fast Forward/Rewind**: Keyboard shortcuts for fast forward/rewind

### 7.2 Accessibility Support
- **Focus Management**: Manages UI focus to ensure smooth keyboard navigation
- **ARIA Labels**: Provides appropriate ARIA labels for screen reader support
- **Keyboard Navigation**: Supports keyboard operation of all functions

### 7.3 Error Handling
- **Error Boundaries**: Uses React error boundaries to catch component errors
- **Error Recovery**: Provides appropriate error recovery mechanisms
- **Error Messages**: Displays user-friendly error messages

## 8. Advanced Features

### 8.1 Audio Analysis
- **Frequency Analysis**: Uses Web Audio API for real-time frequency analysis
- **Visualization Data**: Provides real-time audio data for visualization
- **Performance Optimization**: Optimizes analysis performance to minimize impact on playback

### 8.2 iOS-Specific Handling
- **iOS Compatibility**: Special handling for iOS devices
- **WebKit Compatibility**: Handles iOS/WebKit specific limitations
- **Fallback Mechanism**: Provides appropriate fallback solutions on iOS
