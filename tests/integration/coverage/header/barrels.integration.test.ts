import Header from '../../../../src/features/landing/components/Header';
import { AuthButtons } from '../../../../src/features/landing/components/Header/AuthButtons';
import { Drawer } from '../../../../src/features/landing/components/Header/Drawer';
import { VilnaCRMEmail } from '../../../../src/features/landing/components/Header/Drawer/VilnaCRMEmail';
import { NavItem } from '../../../../src/features/landing/components/Header/NavItem';
import { NavList } from '../../../../src/features/landing/components/Header/NavList';

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
