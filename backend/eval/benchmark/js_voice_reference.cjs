/**
 * Reference implementation check: runs the app's ORIGINAL JavaScript voice-feature
 * code (sliced out of the React sources at run time, not re-typed) on raw audio,
 * so the Python port in voice_features.py can be verified against it.
 *
 * usage: node js_voice_reference.cjs <frontend/src dir> <samples.f32> <sampleRate> <template|probe>
 *   samples.f32: little-endian float32 mono samples
 * prints the 64-value feature as JSON
 */
const fs = require('fs');
const path = require('path');

const [srcDir, f32Path, srArg, mode] = process.argv.slice(2);
const file = mode === 'template' ? 'pages/user/VoiceRegistration.jsx' : 'pages/user/InterviewSession.jsx';
const src = fs.readFileSync(path.join(srcDir, file), 'utf8');

function sliceFunction(source, header) {
  const start = source.indexOf(header);
  if (start < 0) throw new Error('not found: ' + header);
  let i = source.indexOf('{', start), depth = 0;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('unbalanced: ' + header);
}

// Helper functions used by the feature code, verbatim
const helpers = ['function bitReverse(', 'function fft(', 'function getFFTMagnitude('].map(h => sliceFunction(src, h)).join('\n');

// Feature function: keep everything after the line that reads the sample rate,
// up to the end of the function (minus the catch block in the interview version)
let fn = sliceFunction(src, 'async function extractVoiceEmbedding(chunks)');
const after = fn.indexOf('audioBuf.sampleRate;');
let body = fn.slice(fn.indexOf('\n', after) + 1);
body = body.slice(0, body.lastIndexOf('}'));                 // drop function's closing brace
const catchAt = body.lastIndexOf('} catch (e) {');
if (catchAt >= 0) body = body.slice(0, catchAt);             // drop try/catch tail (interview version)
const feature = new Function('channelData', 'sampleRate', 'duration', helpers + '\n' + body);

console.log = () => {};   // the app code prints a [DEBUG] line; keep stdout pure JSON
const buf = fs.readFileSync(f32Path);
const channelData = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
const sr = Number(srArg);
process.stdout.write(JSON.stringify(feature(channelData, sr, channelData.length / sr)));
