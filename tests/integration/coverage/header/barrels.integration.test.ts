import Header from '@components/Header';
import { AuthButtons } from '@components/Header/AuthButtons';
import { Drawer } from '@components/Header/Drawer';
import { VilnaCRMEmail } from '@components/Header/Drawer/VilnaCRMEmail';
import { NavItem } from '@components/Header/NavItem';
import { NavList } from '@components/Header/NavList';

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
