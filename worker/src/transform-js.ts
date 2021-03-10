import { transformSync, TransformOptions } from '@babel/core';
import remap, { RemapOptions } from './remap-plugin';
import ts from '@babel/plugin-transform-typescript';
import { MacrosConfig } from '@embroider/macros/src/node';
import macrosPlugin from '@embroider/macros/src/babel/macros-babel-plugin';
import decorators from '@babel/plugin-proposal-decorators';
import classProperties from '@babel/plugin-proposal-class-properties';
import debugMacros from 'babel-plugin-debug-macros';
import modulesAPI from 'babel-plugin-ember-modules-api-polyfill';
import runtime from '@babel/plugin-transform-runtime';
import { ImportMapper } from './import-mapper';

const macrosConfig = MacrosConfig.for(self);

export class TransformJS {
  constructor(private mapper: ImportMapper) {}

  private async plugins(): Promise<TransformOptions['plugins']> {
    return [
      [
        decorators,
        {
          legacy: true,
        },
      ],
      [
        classProperties,
        {
          loose: false,
        },
      ],
      [
        debugMacros,
        {
          flags: [
            {
              source: '@glimmer/env',
              flags: {
                DEBUG: true,
                CI: false,
              },
            },
          ],
          externalizeHelpers: {
            global: 'Ember',
          },
          debugTools: {
            isDebug: true,
            source: '@ember/debug',
            assertPredicateIndex: 1,
          },
        },
        '@ember/debug stripping',
      ],
      [
        debugMacros,
        {
          externalizeHelpers: {
            global: 'Ember',
          },
          debugTools: {
            isDebug: true,
            source: '@ember/application/deprecations',
            assertPredicateIndex: 1,
          },
        },
        '@ember/application/deprecations stripping',
      ],
      [
        modulesAPI,
        {
          ignore: {
            '@ember/debug': ['assert', 'deprecate', 'warn'],
            '@ember/application/deprecations': ['deprecate'],
          },
        },
      ],
      // TODO: embroider's babel-plugin-inline-hbs
      [macrosPlugin, (macrosConfig.babelPluginConfig() as any)[1]],
      // TODO: embroider's template colocation plugin
      [
        runtime,
        {
          useESModules: true,
          regenerator: false,
        },
      ],
      ts,
      [
        remap,
        {
          mapper: await this.mapper.snapshot(),
        } as RemapOptions,
      ],
    ];
  }

  async run(
    filename: string,
    response: Response,
    forwardHeaders: Headers
  ): Promise<Response> {
    let source = await response.text();
    let result = transformSync(source, {
      filename,
      plugins: await this.plugins(),
      generatorOpts: {
        compact: false,
      },
    });
    return new Response(result!.code, {
      headers: forwardHeaders,
      status: response.status,
      statusText: response.statusText,
    });
  }
}
