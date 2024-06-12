'use client'
import type { ClientCollectionConfig } from 'payload/types'

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext.js'
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection.js'
import { mergeRegister } from '@lexical/utils'
import { getTranslation } from '@payloadcms/translations'
import {
  Button,
  DrawerToggler,
  useConfig,
  useDocumentDrawer,
  useDrawerSlug,
  usePayloadAPI,
  useTranslation,
} from '@payloadcms/ui/client'
import { File } from '@payloadcms/ui/client'
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
} from 'lexical'
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import type { ClientComponentProps } from '../../types.js'
import type { UploadFeaturePropsClient } from '../feature.client.js'
import type { UploadData } from '../nodes/UploadNode.js'

import { useEditorConfigContext } from '../../../lexical/config/client/EditorConfigProvider.js'
import { EnabledRelationshipsCondition } from '../../relationship/utils/EnabledRelationshipsCondition.js'
import { INSERT_UPLOAD_WITH_DRAWER_COMMAND } from '../drawer/commands.js'
import { $isUploadNode } from '../nodes/UploadNode.js'
import { ExtraFieldsUploadDrawer } from './ExtraFieldsDrawer/index.js'
import './index.scss'

const baseClass = 'lexical-upload'

const initialParams = {
  depth: 0,
}

export type ElementProps = {
  data: UploadData
  nodeKey: string
}

const Component: React.FC<ElementProps> = (props) => {
  const {
    data: { fields, relationTo, value },
    nodeKey,
  } = props

  const {
    collections,
    routes: { api },
    serverURL,
  } = useConfig()
  const uploadRef = useRef<HTMLDivElement | null>(null)

  const [editor] = useLexicalComposerContext()
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey)

  const { editorConfig, field } = useEditorConfigContext()

  const { i18n, t } = useTranslation()
  const [cacheBust, dispatchCacheBust] = useReducer((state) => state + 1, 0)
  const [relatedCollection, setRelatedCollection] = useState<ClientCollectionConfig>(() =>
    collections.find((coll) => coll.slug === relationTo),
  )

  const drawerSlug = useDrawerSlug('upload-drawer')

  const [DocumentDrawer, DocumentDrawerToggler, { closeDrawer }] = useDocumentDrawer({
    id: value,
    collectionSlug: relatedCollection.slug,
  })

  // Get the referenced document
  const [{ data }, { setParams }] = usePayloadAPI(
    `${serverURL}${api}/${relatedCollection.slug}/${value}`,
    { initialParams },
  )

  const thumbnailSRC = data?.thumbnailURL || data?.url

  const removeUpload = useCallback(() => {
    editor.update(() => {
      $getNodeByKey(nodeKey).remove()
    })
  }, [editor, nodeKey])

  const updateUpload = useCallback(
    (json) => {
      setParams({
        ...initialParams,
        cacheBust, // do this to get the usePayloadAPI to re-fetch the data even though the URL string hasn't changed
      })

      dispatchCacheBust()
      closeDrawer()
    },
    [setParams, cacheBust, closeDrawer],
  )

  const $onDelete = useCallback(
    (payload: KeyboardEvent) => {
      if (isSelected && $isNodeSelection($getSelection())) {
        const event: KeyboardEvent = payload
        event.preventDefault()
        const node = $getNodeByKey(nodeKey)
        if ($isUploadNode(node)) {
          node.remove()
          return true
        }
      }
      return false
    },
    [isSelected, nodeKey],
  )
  const onClick = useCallback(
    (payload: MouseEvent) => {
      const event = payload
      // Check if uploadRef.target or anything WITHIN uploadRef.target was clicked
      if (event.target === uploadRef.current || uploadRef.current?.contains(event.target as Node)) {
        if (event.shiftKey) {
          setSelected(!isSelected)
        } else {
          if (!isSelected) {
            clearSelection()
            setSelected(true)
          }
        }
        return true
      }

      return false
    },
    [isSelected, setSelected, clearSelection],
  )

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand<MouseEvent>(CLICK_COMMAND, onClick, COMMAND_PRIORITY_LOW),

      editor.registerCommand(KEY_DELETE_COMMAND, $onDelete, COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_BACKSPACE_COMMAND, $onDelete, COMMAND_PRIORITY_LOW),
    )
  }, [clearSelection, editor, isSelected, nodeKey, $onDelete, setSelected, onClick])

  const hasExtraFields = (
    editorConfig?.resolvedFeatureMap?.get('upload')
      ?.clientFeatureProps as ClientComponentProps<UploadFeaturePropsClient>
  ).collections?.[relatedCollection.slug]?.hasExtraFields

  return (
    <div
      className={[baseClass, isSelected && `${baseClass}--selected`].filter(Boolean).join(' ')}
      contentEditable={false}
      ref={uploadRef}
    >
      <div className={`${baseClass}__card`}>
        <div className={`${baseClass}__topRow`}>
          {/* TODO: migrate to use @payloadcms/ui/elements/Thumbnail component */}
          <div className={`${baseClass}__thumbnail`}>
            {thumbnailSRC ? (
              <img
                alt={data?.filename}
                data-lexical-upload-id={value}
                data-lexical-upload-relation-to={relationTo}
                src={thumbnailSRC}
              />
            ) : (
              <File />
            )}
          </div>
          <div className={`${baseClass}__topRowRightPanel`}>
            <div className={`${baseClass}__collectionLabel`}>
              {getTranslation(relatedCollection.labels.singular, i18n)}
            </div>
            {editor.isEditable() && (
              <div className={`${baseClass}__actions`}>
                {hasExtraFields ? (
                  <DrawerToggler
                    className={`${baseClass}__upload-drawer-toggler`}
                    disabled={field?.readOnly}
                    slug={drawerSlug}
                  >
                    <Button
                      buttonStyle="icon-label"
                      el="div"
                      icon="edit"
                      onClick={(e) => {
                        e.preventDefault()
                      }}
                      round
                      tooltip={t('fields:editRelationship')}
                    />
                  </DrawerToggler>
                ) : null}

                <Button
                  buttonStyle="icon-label"
                  disabled={field?.readOnly}
                  el="div"
                  icon="swap"
                  onClick={() => {
                    editor.dispatchCommand(INSERT_UPLOAD_WITH_DRAWER_COMMAND, {
                      replace: { nodeKey },
                    })
                  }}
                  round
                  tooltip={t('fields:swapUpload')}
                />
                <Button
                  buttonStyle="icon-label"
                  className={`${baseClass}__removeButton`}
                  disabled={field?.readOnly}
                  icon="x"
                  onClick={(e) => {
                    e.preventDefault()
                    removeUpload()
                  }}
                  round
                  tooltip={t('fields:removeUpload')}
                />
              </div>
            )}
          </div>
        </div>
        <div className={`${baseClass}__bottomRow`}>
          <DocumentDrawerToggler className={`${baseClass}__doc-drawer-toggler`}>
            <strong>{data?.filename}</strong>
          </DocumentDrawerToggler>
        </div>
      </div>
      {value && <DocumentDrawer onSave={updateUpload} />}
      {hasExtraFields ? (
        <ExtraFieldsUploadDrawer
          drawerSlug={drawerSlug}
          relatedCollection={relatedCollection}
          {...props}
        />
      ) : null}
    </div>
  )
}

export const UploadComponent = (props: ElementProps): React.ReactNode => {
  return (
    <EnabledRelationshipsCondition {...props} uploads>
      <Component {...props} />
    </EnabledRelationshipsCondition>
  )
}
