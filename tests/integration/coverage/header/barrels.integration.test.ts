import Header from '@landing/header';
import { AuthButtons } from '@landing/header/auth-buttons';
import { Drawer } from '@landing/header/drawer';
import { VilnaCRMEmail } from '@landing/header/drawer/vilna-crm-email';
import { NavItem } from '@landing/header/nav-item';
import { NavList } from '@landing/header/nav-list';

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
