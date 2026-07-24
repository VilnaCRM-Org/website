import { Stack, List } from '@mui/material';
import React, { CSSProperties } from 'react';

import { NavItem } from '../nav-item';

import styles from './styles';
import { NavListProps } from './types';

function NavList({ navItems, handleClick }: NavListProps): React.ReactElement {
  const [firstItem] = navItems;
  if (firstItem === undefined) return <>Something went wrong</>;

  const wrapperStyle: CSSProperties =
    firstItem.type === 'header' ? styles.wrapper : styles.drawerWrapper;

  const contentStyle: CSSProperties =
    firstItem.type === 'header' ? styles.content : styles.drawerContent;

  return (
    <Stack component="nav" sx={wrapperStyle}>
      <List sx={contentStyle}>
        {navItems.map(item => (
          <NavItem
            item={item}
            key={item.id}
            handleClick={handleClick ? (): void => handleClick(item.link) : undefined}
          />
        ))}
      </List>
    </Stack>
  );
}

export default NavList;
