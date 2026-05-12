export type Keyframe = {
  time: number;
  value: number;
};

export type ColorCurve = {
  r: Keyframe[];
  g: Keyframe[];
  b: Keyframe[];
  a: Keyframe[];
};

export type Channel = 'r' | 'g' | 'b' | 'a';
