import { NavItemProps } from '../../../types/header/navigation';

export interface NavListProps {
  navItems: NavItemProps[];
  handleClick?: (link: string) => void;
}
