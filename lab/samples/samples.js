// Voice clips the Lab's audio pages share. All public domain: LibriVox
// volunteer readings (archive.org) and NASA mission recordings (Wikimedia
// Commons), cut to one line each and converted to mono AAC for every browser.
export const SAMPLES = [
  { file: 'thoreau-walden.m4a', label: 'Thoreau, Walden', kind: 'reading',
    said: 'I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived.',
    credit: 'Henry David Thoreau, Walden (1854), read by a LibriVox volunteer. Public domain.' },
  { file: 'emerson-self-reliance.m4a', label: 'Emerson, Self-Reliance', kind: 'reading',
    said: 'Trust thyself: every heart vibrates to that iron string.',
    credit: 'Ralph Waldo Emerson, Self-Reliance (1841), read by a LibriVox volunteer. Public domain.' },
  { file: 'epictetus-enchiridion.m4a', label: 'Epictetus, Enchiridion', kind: 'reading',
    said: 'There are things which are within our power, and there are things which are beyond our power.',
    credit: 'Epictetus, the Enchiridion (Higginson translation), read by a LibriVox volunteer. Public domain.' },
  { file: 'apollo11-eagle.m4a', label: 'Apollo 11, 1969', kind: 'radio',
    said: 'Houston, Tranquility Base here. The Eagle has landed.',
    credit: 'Neil Armstrong on Apollo 11, 1969. NASA, public domain.' },
  { file: 'apollo13-houston.m4a', label: 'Apollo 13, 1970', kind: 'radio',
    said: "Houston, we've had a problem.",
    credit: 'The Apollo 13 crew and Mission Control, 1970. NASA, public domain.' },
  { file: 'apollo11-small-step.m4a', label: 'Apollo 11, 1969', kind: 'radio',
    said: "That's one small step for man, one giant leap for mankind.",
    credit: 'Neil Armstrong on the Moon, 1969. NASA, public domain.' },
];

export const sample = (file) => SAMPLES.find((s) => s.file === file);
export const sampleUrl = (s) => new URL(`./${s.file}`, import.meta.url).href;
