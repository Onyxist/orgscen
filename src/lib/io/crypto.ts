import type { Project } from '../domain/model';
import { parseProject, serializeProject } from './project';

interface EncryptedProjectEnvelope {
  format: 'orgscenario-encrypted';
  version: 1;
  kdf: {
    name: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    salt: string;
  };
  cipher: {
    name: 'AES-GCM';
    iv: string;
    data: string;
  };
}

const ITERATIONS = 250_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function isEncryptedProject(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as Partial<EncryptedProjectEnvelope>;
    return parsed.format === 'orgscenario-encrypted' && parsed.version === 1;
  } catch {
    return false;
  }
}

export async function encryptProject(project: Project, password: string): Promise<string> {
  if (!password) throw new Error('Password is required.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    encoder.encode(serializeProject(project))
  );

  const envelope: EncryptedProjectEnvelope = {
    format: 'orgscenario-encrypted',
    version: 1,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: ITERATIONS,
      salt: toBase64(salt)
    },
    cipher: {
      name: 'AES-GCM',
      iv: toBase64(iv),
      data: toBase64(new Uint8Array(encrypted))
    }
  };

  return JSON.stringify(envelope, null, 2);
}

export async function decryptProject(text: string, password: string): Promise<Project> {
  if (!password) throw new Error('Password is required.');
  const envelope = JSON.parse(text) as EncryptedProjectEnvelope;
  if (envelope.format !== 'orgscenario-encrypted' || envelope.version !== 1) {
    throw new Error('This is not a supported encrypted OrgScenario project.');
  }

  try {
    const salt = fromBase64(envelope.kdf.salt);
    const iv = fromBase64(envelope.cipher.iv);
    const data = fromBase64(envelope.cipher.data);
    const key = await deriveKey(password, salt, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, toArrayBuffer(data));
    return parseProject(decoder.decode(decrypted));
  } catch {
    throw new Error('Could not decrypt project. Wrong password or damaged file.');
  }
}

async function deriveKey(password: string, salt: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usages
  );
}


function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
