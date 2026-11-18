import { fileIdentity } from './object-urls';

/** A saved attachment or an AI SDK file part; only local Files need byte access. */
export interface RemoteFile {
  readonly url: string;
  readonly mediaType: string;
  readonly filename?: string;
}
export type Attachment = File | RemoteFile;
export const attachmentName = (file: Attachment): string =>
  'url' in file ? (file.filename ?? 'Attachment') : file.name;
export const attachmentType = (file: Attachment): string =>
  'url' in file ? file.mediaType : file.type;
export const attachmentIdentity = (file: Attachment): string =>
  'url' in file ? JSON.stringify([file.url, file.mediaType, file.filename]) : fileIdentity(file);
