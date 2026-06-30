# Worked example: the landing sign-up flow

This traces one real feature flow end to end — the landing sign-up form — so the
Component to Hook to Apollo/data to API layering is concrete. All paths are real;
the snippets are trimmed for focus.

## 1. Page = route + composition root

`pages/index.tsx` renders the feature through its public barrel only:

```tsx
import { LandingComponent } from '@/features/landing';

export default function Home(): React.ReactElement {
  return <LandingComponent />;
}
```

`pages/_app.tsx` is the composition root. It mounts the Apollo provider with the
client built inside the feature, and (because `src/components` may not import a
feature) it injects the landing Header here rather than from the shared `Layout`:

```tsx
import { ApolloProvider } from '@apollo/client/react';
import dynamic from 'next/dynamic';

import Layout from '@/components/Layout';

import client from '../src/features/landing/api/graphql/apollo';

const DynamicHeader = dynamic(() => import('@/features/landing/components/Header'), {
  ssr: false,
});
```

`pages/` lives outside `src/`, so `features-import-via-public-api` does not apply
to it — this is the one layer allowed to reach feature internals to wire routes.

## 2. Data layer: ApolloClient + gql documents (`api/`)

`src/features/landing/api/graphql/apollo.ts` builds the client:

```ts
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import i18n from 'i18next';

const httpLink = new HttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_API_URL,
});

// Resolve the active language per request so a later language switch is reflected.
const languageLink = setContext((_, { headers }) => ({
  headers: {
    ...headers,
    'Accept-Language': i18n.language || 'en-US',
  },
}));

const client = new ApolloClient({
  link: languageLink.concat(httpLink),
  cache: new InMemoryCache(),
});

export default client;
```

`src/features/landing/api/service/userService.ts` defines the mutation as a
`TypedDocumentNode`, with its input/payload types in `api/service/types.ts`:

```ts
import { TypedDocumentNode, gql } from '@apollo/client';

import { CreateUserPayload, CreateUserVariables } from './types';

const SIGNUP_MUTATION: TypedDocumentNode<CreateUserPayload, CreateUserVariables> = gql`
  mutation AddUser($input: createUserInput!) {
    createUser(input: $input) {
      user {
        email
        initials
        id
        confirmed
      }
      clientMutationId
    }
  }
`;
export default SIGNUP_MUTATION;
```

This `api/` folder is the website's analog of CRM's repository layer: it owns the
client and the typed GraphQL documents. No `dependency-cruiser` rule forces other
layers to go through it, but by convention components reach data via hooks and
documents, not by constructing clients inline.

## 3. Component + hook: react-hook-form meets Apollo

`components/AuthSection/AuthForm/AuthLayout.tsx` wires the form (react-hook-form)
to the mutation (Apollo `useMutation`), maps failures with a helper, and delegates
post-submit reset to a feature hook:

```tsx
import { useMutation } from '@apollo/client/react';
import { useForm } from 'react-hook-form';

import SIGNUP_MUTATION from '../../../api/service/userService';
import { handleApolloError } from '../../../helpers/handleApolloError';
import useFormReset from '../../../hooks/useFormReset';
import { RegisterItem } from '../../../types/authentication/form';

function AuthLayout() {
  const { handleSubmit, control, reset, formState } = useForm<RegisterItem>({
    mode: 'onTouched',
  });
  const [signup, { loading }] = useMutation(SIGNUP_MUTATION);

  const onSubmit = async (data: RegisterItem) => {
    try {
      await signup({ variables: { input: { email: data.Email.toLowerCase() } } });
    } catch (error) {
      const message = handleApolloError({ error });
      // surface `message` through the Notification component
    }
  };

  useFormReset({ formState, reset });

  return <form onSubmit={handleSubmit(onSubmit)}>{/* fields + Notification */}</form>;
}

export default AuthLayout;
```

The reusable effect lives in `hooks/use-*.ts`, keeping the component lean:

```ts
import { useEffect } from 'react';

import { RegisterItem } from '../types/authentication/form';

interface UseFormResetProps {
  formState: { isSubmitSuccessful: boolean };
  reset: (values: RegisterItem) => void;
  notificationType?: string;
}

function useFormReset({ formState, reset, notificationType }: UseFormResetProps) {
  useEffect(() => {
    if (formState.isSubmitSuccessful && notificationType !== 'error') {
      reset({ Email: '', FullName: '', Password: '', Privacy: false });
    }
  }, [formState.isSubmitSuccessful, notificationType, reset]);
}

export default useFormReset;
```

## 4. Helpers: pure error mapping

`helpers/handleApolloError.ts` turns an Apollo/GraphQL/network error into a
localized client message (via `@/shared/clientErrorMessages`). It is a pure
function — no React, no client — so it sits in `helpers/`, not `hooks/` or `api/`:

```ts
import { handleApolloError } from '../../../helpers/handleApolloError';

const message = handleApolloError({ error });
```

## Placement examples

- A new GraphQL query for the landing newsletter box -> add the document under
  `src/features/landing/api/service/`, consume it from a `use-*` hook, render in a
  `components/` component. Export the component from `src/features/landing/index.ts`.
- A button used by both `landing` and `swagger` -> it is shared UI, so it belongs
  in `src/components/<UiButton>`, importing no feature. Both features import it via
  the `@/components` alias.
- A date/string formatter used in two features -> a foundational layer
  (`src/utils` or `src/lib`); never import one feature's helper from another.

## Worked fix: a lint-deps violation

You add `import { SwaggerPanel } from '@/features/swagger/components/SwaggerPanel'`
inside a `landing` component. `make lint-deps` reports:

```text
error no-cross-feature-imports: src/features/landing/components/...
  -> src/features/swagger/components/SwaggerPanel
```

The fix is structural, not a suppression: if `SwaggerPanel` is genuinely shared,
promote it to `src/components/`; if it is swagger-specific, the landing component
should not depend on it at all. Re-run `make lint-deps` until it is clean, then
`make format` and `make lint`.
