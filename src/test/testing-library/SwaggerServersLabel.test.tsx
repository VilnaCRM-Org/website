import { render, screen } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import {
  ServersContainerProps,
  serversLabelPlugin,
  swaggerPlugins,
  withServersLabel,
} from '@swagger/components/api-documentation/servers';

/**
 * Regression coverage for #424: the swagger-ui servers dropdown (`<select id="servers">`)
 * had no accessible name, because the widget's own `<label for="servers">` wraps the
 * select without any text. `withServersLabel` wraps swagger-ui's `ServersContainer`
 * through the `wrapComponents` plugin API and adds a visually-hidden label, so the
 * control is named without patching the widget's DOM.
 *
 * The widget is stood in for by a stub that renders exactly the markup swagger-ui emits
 * for the container — the empty wrapping label around the select — so `getByLabelText`
 * proves the association the route axe scan (`select-name`) checks in the real build.
 *
 * Loading / error — Not applicable: the wrapper is synchronous and has no async boundary.
 * Permission / auth — Not applicable: a static documentation control.
 */
function UpstreamServersContainer({ specSelectors }: ServersContainerProps): React.ReactElement {
  const count: number = specSelectors.servers()?.size ?? 0;

  return (
    <div>
      <span className="servers-title">Servers</span>
      <div className="servers">
        <label htmlFor="servers">
          <select id="servers">
            {Array.from({ length: count }, (_, index) => `http://server-${index}`).map(url => (
              <option key={url} value={url}>
                {url}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

const Labelled: React.ComponentType<ServersContainerProps> =
  withServersLabel(UpstreamServersContainer);

function propsWith(servers: { size: number } | null): ServersContainerProps {
  return { specSelectors: { servers: () => servers } };
}

describe('withServersLabel (#424)', () => {
  it('names the servers select by its visible-to-AT label', () => {
    render(<Labelled {...propsWith({ size: 1 })} />);

    const select: HTMLElement = screen.getByLabelText(t('api_documentation.servers_label'));

    expect(select).toBeInstanceOf(HTMLSelectElement);
    expect(select).toHaveAttribute('id', 'servers');
    expect(screen.getByRole('combobox', { name: t('api_documentation.servers_label') })).toBe(
      select
    );
  });

  it('keeps the label out of the visual layout', () => {
    render(<Labelled {...propsWith({ size: 1 })} />);

    const label: HTMLElement = screen.getByText(t('api_documentation.servers_label'));

    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveStyle({ position: 'absolute', width: '1px', height: '1px' });
  });

  it('still renders the upstream container and its options', () => {
    render(<Labelled {...propsWith({ size: 2 })} />);

    expect(screen.getByText('Servers')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it.each<[string, { size: number } | null]>([
    ['no servers', { size: 0 }],
    ['an undefined server list', null],
  ])('renders nothing — no orphan label — for %s', (_case, servers) => {
    const { container } = render(<Labelled {...propsWith(servers)} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(t('api_documentation.servers_label'))).not.toBeInTheDocument();
  });

  it('is registered as the ServersContainer wrapper of the plugin ApiDocumentation passes', () => {
    expect(serversLabelPlugin.wrapComponents.ServersContainer).toBe(withServersLabel);
    expect(swaggerPlugins).toEqual([serversLabelPlugin]);
  });
});
