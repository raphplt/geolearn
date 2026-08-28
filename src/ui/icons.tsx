import Svg, { Circle, Ellipse, G, Line, Path } from 'react-native-svg';

export type IconProps = {
  size?: number;
  color: string;
  active?: boolean;
};

const VIEW = 24;

function Frame({ size = 24, children }: { size?: number; children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`} fill="none">
      {children}
    </Svg>
  );
}

export function IconCap({ size, color, active }: IconProps) {
  const w = active ? 2 : 1.5;
  return (
    <Frame size={size}>
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={w} />
      <Path
        d="M12 4.5 L14 12 L12 19.5 L10 12 Z"
        stroke={color}
        strokeWidth={w}
        strokeLinejoin="round"
        fill={active ? color : 'none'}
      />
      <Path d="M4.5 12 L12 10 L19.5 12 L12 14 Z" stroke={color} strokeWidth={w} strokeLinejoin="round" />
    </Frame>
  );
}

export function IconAtlas({ size, color, active }: IconProps) {
  const w = active ? 2 : 1.5;
  return (
    <Frame size={size}>
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={w} />
      <Line x1={3} y1={12} x2={21} y2={12} stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Ellipse cx={12} cy={12} rx={4.2} ry={9} stroke={color} strokeWidth={w} />
      <Path d="M5 7.2 C8 8.8, 16 8.8, 19 7.2" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Path d="M5 16.8 C8 15.2, 16 15.2, 19 16.8" stroke={color} strokeWidth={w} strokeLinecap="round" />
    </Frame>
  );
}

export function IconCabine({ size, color, active }: IconProps) {
  const w = active ? 2 : 1.5;

  const RIM = 7.4;
  const HUB = 2.4;
  const GRIP = 2.1;

  const spokes = [0, 45, 90, 135].map((deg) => {
    const a = (deg * Math.PI) / 180;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    return (
      <G key={deg}>
        <Line
          x1={12 - dx * RIM}
          y1={12 - dy * RIM}
          x2={12 + dx * RIM}
          y2={12 + dy * RIM}
          stroke={color}
          strokeWidth={w}
          strokeLinecap="round"
        />
        <Line
          x1={12 + dx * RIM}
          y1={12 + dy * RIM}
          x2={12 + dx * (RIM + GRIP)}
          y2={12 + dy * (RIM + GRIP)}
          stroke={color}
          strokeWidth={w}
          strokeLinecap="round"
        />
        <Line
          x1={12 - dx * RIM}
          y1={12 - dy * RIM}
          x2={12 - dx * (RIM + GRIP)}
          y2={12 - dy * (RIM + GRIP)}
          stroke={color}
          strokeWidth={w}
          strokeLinecap="round"
        />
      </G>
    );
  });

  return (
    <Frame size={size}>
      {spokes}
      <Circle cx={12} cy={12} r={RIM} stroke={color} strokeWidth={w + 0.4} fill="none" />
      <Circle cx={12} cy={12} r={HUB} fill={color} />
    </Frame>
  );
}

export function IconHourglass({ size, color, active }: IconProps) {
  const w = active ? 2 : 1.5;
  return (
    <Frame size={size}>
      <Path
        d="M7 3.5 H17 M7 20.5 H17 M8 3.5 V7 L12 12 L16 7 V3.5 M8 20.5 V17 L12 12 L16 17 V20.5"
        stroke={color}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  );
}

export function IconSeal({ size, color, active }: IconProps) {
  const w = active ? 2 : 1.5;
  return (
    <Frame size={size}>
      <Circle cx={12} cy={10} r={6.2} stroke={color} strokeWidth={w} />
      <Path d="M9.4 10.2 L11.2 12 L14.8 8.2" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8.6 15.4 L7.4 21 L12 19 L16.6 21 L15.4 15.4" stroke={color} strokeWidth={w} strokeLinejoin="round" />
    </Frame>
  );
}

export function IconDoublon({ size, color, active }: IconProps) {
  const w = active ? 2 : 1.5;
  return (
    <Frame size={size}>
      <Circle cx={12} cy={12} r={8.6} stroke={color} strokeWidth={w} />
      <Circle cx={12} cy={12} r={6} stroke={color} strokeWidth={w * 0.7} opacity={0.55} />
      <Path
        d="M12 8.2 L13.1 11 L16 11.2 L13.8 13.1 L14.5 16 L12 14.4 L9.5 16 L10.2 13.1 L8 11.2 L10.9 11 Z"
        fill={active ? color : 'none'}
        stroke={color}
        strokeWidth={w * 0.8}
        strokeLinejoin="round"
      />
    </Frame>
  );
}

export function IconBrevet({ size, color, active }: IconProps) {
  const w = active ? 2 : 1.5;
  return (
    <Frame size={size}>
      <Circle cx={12} cy={9} r={5.4} stroke={color} strokeWidth={w} fill={active ? color : 'none'} />
      <Circle cx={12} cy={9} r={2.1} stroke={color} strokeWidth={w * 0.7} opacity={active ? 0.35 : 1} />
      <Path
        d="M8.4 13.6 L6.6 21 L12 18.6 L17.4 21 L15.6 13.6"
        stroke={color}
        strokeWidth={w}
        strokeLinejoin="round"
        fill="none"
      />
    </Frame>
  );
}

export function IconHull({ size, color, active }: IconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M3.5 10 H20.5 L17.6 18.2 C17.2 19.3 16.2 20 15 20 H9 C7.8 20 6.8 19.3 6.4 18.2 Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill={active ? color : 'none'}
      />
      <Path
        d="M12 10 V4.2 M12 5 L16.4 6.6 L12 8.2"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
        fill="none"
      />
    </Frame>
  );
}
