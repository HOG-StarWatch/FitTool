declare module '@garmin/fitsdk' {
  export class Encoder {
    onMesg(mesgNum: number, values: Record<string, unknown>): void;
    close(): Uint8Array;
  }

  export const Profile: {
    MesgNum: Record<string, number>;
  };
}
