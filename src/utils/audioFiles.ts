export const MP3_EXTENSION = ".mp3";

export function isMp3File(file: File): boolean {
  return file.name.toLowerCase().endsWith(MP3_EXTENSION);
}

export function toFileList(files: File[]): FileList {
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  return dt.files;
}