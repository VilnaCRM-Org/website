import Header from '@landing-components/Header';
import { AuthButtons } from '@landing-components/Header/AuthButtons';
import { Drawer } from '@landing-components/Header/Drawer';
import { VilnaCRMEmail } from '@landing-components/Header/Drawer/VilnaCRMEmail';
import { NavItem } from '@landing-components/Header/NavItem';
import { NavList } from '@landing-components/Header/NavList';

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
