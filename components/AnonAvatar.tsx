import { Avatar } from '@mantine/core';

const INITIALS_COLORS = [
  'violet', 'cyan', 'teal', 'pink', 'orange',
  'indigo', 'grape', 'lime', 'yellow', 'red', 'blue', 'green',
];

interface Props {
  name: string;
  size?: number;
  muted?: boolean;
  className?: string;
}

export function AnonAvatar({ name, size = 28, muted = false, className }: Props) {
  return (
    <Avatar
      name={muted ? undefined : (name || 'AN')}
      color={muted ? 'gray' : 'initials'}
      allowedInitialsColors={INITIALS_COLORS}
      size={size}
      className={className}
    />
  );
}
