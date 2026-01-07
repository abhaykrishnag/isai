import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Play, Pause, SkipBack, SkipForward, Upload, Trash2, LogOut, Music } from 'lucide-react';
import './index.css';

const API_BASE = '/api';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [songs, setSongs] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const audioRef = useRef(new Audio());

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/user`);
      setUser(data.user);
      fetchSongs();
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchSongs = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/songs`);
      setSongs(data);
    } catch (err) {
      console.error('Failed to fetch songs');
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${API_BASE}/upload`, formData);
      fetchSongs();
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsUploading(false);
    }
  };

  const playSong = (song) => {
    if (currentSong?.id === song.id) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
      return;
    }

    setCurrentSong(song);
    audioRef.current.src = `${API_BASE}/stream/${song.id}`;
    audioRef.current.play();
    setIsPlaying(true);
  };

  useEffect(() => {
    const audio = audioRef.current;

    const updateProgress = () => {
      setProgress(audio.currentTime);
      setDuration(audio.duration || 0);
    };

    const handleEnded = () => {
      // Logic for next song could go here
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateProgress);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', updateProgress);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const seek = (e) => {
    const rect = e.target.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pos * audioRef.current.duration;
  };

  const deleteSong = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this song?')) return;

    try {
      await axios.delete(`${API_BASE}/songs/${id}`);
      fetchSongs();
      if (currentSong?.id === id) {
        audioRef.current.pause();
        setCurrentSong(null);
        setIsPlaying(false);
      }
    } catch (err) {
      alert('Delete failed');
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) return null;

  if (!user) {
    return (
      <div className="auth-container">
        <h1 className="logo">Isai</h1>
        <p style={{ margin: '20px 0', color: 'var(--secondary-text)' }}>Your personal music locker.</p>
        <a href="http://localhost:5001/auth/google" className="btn">Sign in with Google</a>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="navbar">
        <div className="logo">Isai</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span className="user-email">{user.emails[0].value}</span>
          <button onClick={() => axios.post(`${API_BASE}/logout`).then(() => window.location.reload())} className="control-btn">
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <main className="main-content">
        <div className="upload-section">
          <label style={{ cursor: 'pointer' }}>
            <Upload size={32} style={{ marginBottom: '10px' }} />
            <p>{isUploading ? 'Uploading...' : 'Click to upload audio'}</p>
            <input type="file" className="hidden" accept="audio/*" onChange={handleUpload} disabled={isUploading} />
          </label>
        </div>

        <div className="song-list">
          {songs.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--secondary-text)' }}>No songs yet. Upload some music to get started.</p>
          ) : (
            songs.map(song => (
              <div
                key={song.id}
                className={`song-item ${currentSong?.id === song.id ? 'active' : ''}`}
                onClick={() => playSong(song)}
              >
                <div className="song-info">
                  <span className="song-title">{song.name}</span>
                  <span className="song-meta">{new Date(song.createdTime).toLocaleDateString()}</span>
                </div>
                <div className="song-meta" style={{ textAlign: 'right' }}>
                  {formatTime(song.properties?.duration)}
                </div>
                <div className="song-meta song-meta-desktop" style={{ textAlign: 'right' }}>
                  {(song.size / (1024 * 1024)).toFixed(1)} MB
                </div>
                <button className="control-btn" onClick={(e) => deleteSong(e, song.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </main>

      {currentSong && (
        <div className="player-bar">
          <div className="player-controls">
            <button className="control-btn"><SkipBack size={24} /></button>
            <button className="control-btn" onClick={() => playSong(currentSong)}>
              {isPlaying ? <Pause size={32} /> : <Play size={32} />}
            </button>
            <button className="control-btn"><SkipForward size={24} /></button>
          </div>

          <div className="progress-container">
            <span className="time">{formatTime(progress)}</span>
            <div className="progress-bar" onClick={seek}>
              <div className="progress-fill" style={{ width: `${(progress / duration) * 100}%` }}></div>
            </div>
            <span className="time">{formatTime(duration)}</span>
          </div>

          <div className="song-name-display" style={{ minWidth: '200px', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {currentSong.name}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
