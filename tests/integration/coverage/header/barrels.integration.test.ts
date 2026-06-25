import Header from '@landing/Header';
import { AuthButtons } from '@landing/Header/AuthButtons';
import { Drawer } from '@landing/Header/Drawer';
import { VilnaCRMEmail } from '@landing/Header/Drawer/VilnaCRMEmail';
import { NavItem } from '@landing/Header/NavItem';
import { NavList } from '@landing/Header/NavList';

describe('integration: Header barrels', () => {
  it('re-exports every Header module entrypoint', () => {
    expect(Header).toBeDefined();
    expect(AuthButtons).toBeDefined();
    expect(Drawer).toBeDefined();
    expect(VilnaCRMEmail).toBeDefined();
    expect(NavItem).toBeDefined();
    expect(NavList).toBeDefined();
  });
});
