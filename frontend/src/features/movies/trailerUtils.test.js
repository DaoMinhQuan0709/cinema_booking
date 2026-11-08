import test from 'node:test';
import assert from 'node:assert/strict';
import { getYouTubeVideoId } from './trailerUtils.js';

test('accepts supported YouTube URL forms and query parameters in any order', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=Vgta7UsVdhQ',
    'https://www.youtube.com/watch?feature=share&v=Vgta7UsVdhQ&t=1',
    'https://youtu.be/Vgta7UsVdhQ?si=example',
    'https://www.youtube.com/shorts/Vgta7UsVdhQ',
    'https://www.youtube-nocookie.com/embed/Vgta7UsVdhQ',
  ]) assert.equal(getYouTubeVideoId(url), 'Vgta7UsVdhQ');
});

test('rejects deceptive hosts, unsafe schemes, credentials, paths and invalid IDs', () => {
  for (const url of [
    '', null, 'javascript:alert(1)',
    'https://youtube.com.evil.example/watch?v=Vgta7UsVdhQ',
    'https://notyoutube.com/watch?v=Vgta7UsVdhQ',
    'https://evil.example/path/youtube.com/watch?v=Vgta7UsVdhQ',
    'https://www.youtube.com@evil.example/watch?v=Vgta7UsVdhQ',
    'https://www.youtube.com/watch?v=Vgta7UsVdhQextra',
    'https://youtu.be/Vgta7UsVdhQ/other',
  ]) assert.equal(getYouTubeVideoId(url), null);
});
